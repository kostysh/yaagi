import { performance } from 'node:perf_hooks';
import { closeSync, constants, fstatSync, openSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Result } from '@polyphony/core-types';
import { load } from 'sqlite-vec';
import type {
  OperationOptions,
  OwnerFailure,
  StorageCode,
  StorageFailure,
  StoragePort,
} from './contracts.js';
import type { SqlRows, SqlScope, SqlValue } from './sqlite.js';

export class ProbeError extends Error {
  constructor(readonly code: StorageCode) {
    super(code);
  }
}

export function safeFailure(error: unknown): StorageFailure {
  if (error instanceof ProbeError) return { kind: 'storage', code: error.code };
  const primary =
    error instanceof Error &&
    'errcode' in error &&
    typeof error.errcode === 'number'
      ? error.errcode & 255
      : 0;
  const mapped: Record<number, StorageCode> = {
    5: 'busy',
    6: 'busy',
    13: 'full',
    11: 'corrupt',
    26: 'corrupt',
    14: 'unavailable',
    10: 'write_failed',
    8: 'write_failed',
    19: 'sql_failed',
    1: 'sql_failed',
  };
  if (error instanceof Error && 'code' in error) {
    if (
      error.code === 'ERR_OUT_OF_RANGE' ||
      error.code === 'ERR_INVALID_ARG_TYPE' ||
      error.code === 'ERR_INVALID_ARG_VALUE'
    )
      return { kind: 'storage', code: 'sql_failed' };
    if (['ENOENT', 'EACCES', 'ELOOP', 'ENOTDIR'].includes(String(error.code)))
      return { kind: 'storage', code: 'unavailable' };
  }
  return { kind: 'storage', code: mapped[primary] ?? 'callback_failed' };
}

export function openProbeDb(path: string): DatabaseSync {
  let db: DatabaseSync | undefined;
  try {
    // Only caller-provisioned private fixture directories. No agent identity or directory lock.
    const directory = statSync(dirname(path));
    if ((directory.mode & 0o077) !== 0 || directory.uid !== process.getuid?.())
      throw new ProbeError('unavailable');
    const fd = openSync(
      path,
      constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      const file = fstatSync(fd);
      if (
        !file.isFile() ||
        (file.mode & 0o077) !== 0 ||
        file.uid !== directory.uid
      )
        throw new ProbeError('unavailable');
    } finally {
      closeSync(fd);
    }
    db = new DatabaseSync(path, { timeout: 40, allowExtension: true });
    db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=40',
    );
    try {
      load(db);
    } catch {
      throw new ProbeError('incompatible');
    }
    db.enableLoadExtension(false); // Fixed supply only; SQL cannot load another extension.
    if (
      first(db, 'PRAGMA journal_mode') !== 'wal' ||
      first(db, 'PRAGMA synchronous') !== 2 ||
      first(db, 'PRAGMA foreign_keys') !== 1 ||
      first(db, 'PRAGMA busy_timeout') !== 40 ||
      first(db, 'select vec_version()') !== 'v0.1.9'
    ) {
      throw new ProbeError('incompatible');
    }
    return db;
  } catch (error) {
    if (db?.isOpen) db.close();
    throw new ProbeError(safeFailure(error).code);
  }
}

function bind(value: SqlValue): SqlValue {
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new ProbeError('sql_failed');
  return value instanceof Uint8Array ? new Uint8Array(value) : value;
}
function cell(value: unknown): SqlValue {
  if (
    typeof value === 'bigint' &&
    value >= BigInt(Number.MIN_SAFE_INTEGER) &&
    value <= BigInt(Number.MAX_SAFE_INTEGER)
  )
    return Number(value);
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  )
    return value;
  if (value instanceof Uint8Array) return new Uint8Array(value);
  throw new ProbeError('sql_failed');
}

export function first(db: DatabaseSync, sql: string): unknown {
  return Object.values(db.prepare(sql).get() ?? {})[0];
}

// S1 mechanism only. The driver stays private; no agent identity, OS lock or scheduler.
export class ProbeStore implements StoragePort<SqlScope> {
  #active = false;
  constructor(private readonly db: DatabaseSync) {}

  close(): void {
    if (this.#active) throw new ProbeError('busy');
    if (this.db.isOpen) this.db.close();
  }

  async readSnapshot<T>(
    read: (scope: SqlScope) => Promise<T>,
    options: OperationOptions = {},
  ): Promise<Result<T, StorageFailure>> {
    const result = await this.scoped<T, never>(
      'read',
      async (scope) => ({ ok: true, value: await read(scope) }),
      options,
    );
    if (result.ok) return result;
    if (result.error.kind === 'owner')
      throw new Error('unreachable owner failure');
    return { ok: false, error: result.error };
  }

  transact<T, E>(
    write: (scope: SqlScope) => Promise<Result<T, E>>,
    options: OperationOptions = {},
  ): Promise<Result<T, StorageFailure | OwnerFailure<E>>> {
    return this.scoped('write', write, options);
  }

  private async scoped<T, E>(
    mode: 'read' | 'write',
    callback: (scope: SqlScope) => Promise<Result<T, E>>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure | OwnerFailure<E>>> {
    if (!this.db.isOpen)
      return { ok: false, error: { kind: 'storage', code: 'closed' } };
    if (this.#active)
      return { ok: false, error: { kind: 'storage', code: 'busy' } };
    this.#active = true;
    let live = true;
    let poison: StorageFailure | undefined;
    const end = performance.now() + (options.timeoutMs ?? Infinity);
    const check = () => {
      if (!live) throw new ProbeError('scope_ended');
      if (poison) throw new ProbeError(poison.code);
      if (options.signal?.aborted) throw new ProbeError('cancelled');
      if (performance.now() >= end) throw new ProbeError('deadline');
    };
    const busyBudget = () =>
      this.db.exec(
        `PRAGMA busy_timeout = ${Math.max(0, Math.min(40, Math.floor(end - performance.now())))}`,
      );
    const execute = <TValue>(sql: string, action: () => TValue): TValue => {
      try {
        check();
        if (!this.db.isTransaction) throw new ProbeError('sql_failed');
        // Deliberately limited DML surface; trusted code, not a SQL sandbox/parser.
        if (!/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql))
          throw new ProbeError('sql_failed');
        busyBudget();
        const value = action();
        if (!this.db.isTransaction) throw new ProbeError('sql_failed');
        check();
        return value;
      } catch (error) {
        poison ??= safeFailure(error);
        throw new ProbeError(poison.code);
      }
    };
    const scope: SqlScope = {
      all: (sql, params = []) =>
        execute(sql, () => {
          const statement = this.db.prepare(sql);
          statement.setReturnArrays(true);
          statement.setReadBigInts(true);
          const rows: unknown = statement.all(...params.map(bind));
          if (!Array.isArray(rows)) throw new ProbeError('sql_failed');
          return rows.map((row: unknown) => {
            if (!Array.isArray(row)) throw new ProbeError('sql_failed');
            return row.map(cell);
          });
        }),
      run: (sql, params = []) =>
        execute(sql, () => {
          const statement = this.db.prepare(sql);
          statement.setReadBigInts(true);
          const result = statement.run(...params.map(bind));
          const changes = Number(result.changes);
          if (
            !Number.isSafeInteger(changes) ||
            typeof result.lastInsertRowid !== 'bigint'
          )
            throw new ProbeError('sql_failed');
          return { changes, lastInsertRowid: result.lastInsertRowid };
        }),
    };
    let outcome: Result<T, StorageFailure | OwnerFailure<E>>;
    try {
      check();
      this.db.exec(`PRAGMA query_only = ${mode === 'read' ? 'ON' : 'OFF'}`);
      busyBudget();
      this.db.exec(mode === 'write' ? 'BEGIN IMMEDIATE' : 'BEGIN');
      const result = await callback(scope);
      check();
      if (!result.ok) {
        this.db.exec('ROLLBACK');
        outcome = { ok: false, error: { kind: 'owner', error: result.error } };
      } else {
        busyBudget();
        this.db.exec('COMMIT');
        // Once commit succeeded, do not turn late cancellation into a fictitious rollback.
        outcome = { ok: true, value: result.value };
      }
    } catch (error) {
      outcome = { ok: false, error: poison ?? safeFailure(error) };
    } finally {
      live = false;
      try {
        if (this.db.isTransaction) this.db.exec('ROLLBACK');
        this.db.exec('PRAGMA query_only = OFF; PRAGMA busy_timeout = 40');
        if (poison?.code === 'write_failed' || poison?.code === 'corrupt')
          this.db.close();
      } catch {
        // Unusable connection is never returned for new operations.
        if (this.db.isOpen) this.db.close();
      }
      this.#active = false;
    }
    return outcome;
  }
}

export function scalar(rows: SqlRows): SqlValue | undefined {
  return rows[0]?.[0];
}
