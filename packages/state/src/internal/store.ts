import { closeSync, linkSync, mkdtempSync, openSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import type { Result } from '@polyphony/core-types';
import { load } from 'sqlite-vec';
import type {
  OperationOptions,
  OwnerFailure,
  SchemaStatus,
  StorageFailure,
} from '../contracts.js';
import type { SqliteState } from '../node.js';
import type { SqlMigration, SqlScope, SqlValue } from '../sqlite.js';
import { Budget } from './budget.js';
import { fatal, safeFailure, StorageError } from './errors.js';
import { databaseFiles, privateDirectory, privateFile } from './files.js';
import { applyMigrations, inspect } from './migrations.js';

function scalar(db: DatabaseSync, sql: string): unknown {
  return Object.values(db.prepare(sql).get() ?? {})[0];
}

function bind(value: SqlValue): SqlValue {
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new StorageError('sql_failed');
  if (typeof value === 'bigint' && (value < -(1n << 63n) || value >= 1n << 63n))
    throw new StorageError('sql_failed');
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  )
    return value;
  throw new StorageError('sql_failed');
}

function cell(value: SqlValue): SqlValue {
  if (
    typeof value === 'bigint' &&
    value >= BigInt(Number.MIN_SAFE_INTEGER) &&
    value <= BigInt(Number.MAX_SAFE_INTEGER)
  )
    return Number(value);
  return value instanceof Uint8Array ? new Uint8Array(value) : value;
}

export function openStore(
  config: { path: string; migrations: readonly SqlMigration[] },
  budget: Budget,
): SqliteState {
  budget.check();
  if (process.platform !== 'linux' || process.arch !== 'x64')
    throw new StorageError('incompatible');
  const path = resolve(config.path);
  privateDirectory(dirname(path));
  databaseFiles(path, true);
  privateFile(path, true);
  budget.check();
  const db = new DatabaseSync(path, {
    timeout: budget.busyMs(),
    allowExtension: true,
  });
  try {
    db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON',
    );
    try {
      load(db);
    } catch {
      throw new StorageError('incompatible');
    }
    db.enableLoadExtension(false);
    if (
      scalar(db, 'PRAGMA journal_mode') !== 'wal' ||
      scalar(db, 'PRAGMA synchronous') !== 2 ||
      scalar(db, 'PRAGMA foreign_keys') !== 1 ||
      scalar(db, 'SELECT vec_version()') !== 'v0.1.9'
    )
      throw new StorageError('incompatible');
    databaseFiles(path);
    budget.check();
    db.exec('BEGIN');
    inspect(db, config.migrations, budget);
    db.exec('ROLLBACK');
    db.exec('PRAGMA busy_timeout=40');
    return new SqliteStore(db, path, config.migrations);
  } catch (error) {
    db.close();
    throw error;
  }
}

class SqliteStore implements SqliteState {
  readonly #db: DatabaseSync;
  readonly #path: string;
  readonly #migrations: readonly SqlMigration[];
  #active = false;

  constructor(
    db: DatabaseSync,
    path: string,
    migrations: readonly SqlMigration[],
  ) {
    this.#db = db;
    this.#path = path;
    this.#migrations = migrations;
  }

  async close(): Promise<Result<void, StorageFailure>> {
    if (this.#active)
      return { ok: false, error: { kind: 'storage', code: 'busy' } };
    try {
      if (this.#db.isOpen) this.#db.close();
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: safeFailure(error) };
    }
  }

  async #exclusive<T, E = never>(
    options: OperationOptions,
    action: (budget: Budget) => Promise<Result<T, E>> | Result<T, E>,
  ): Promise<Result<T, E | StorageFailure>> {
    let acquired = false;
    let failure: StorageFailure | undefined;
    try {
      const budget = new Budget(options);
      if (!this.#db.isOpen) throw new StorageError('closed');
      if (this.#active) throw new StorageError('busy');
      this.#active = acquired = true;
      databaseFiles(this.#path);
      this.#db.exec(`PRAGMA busy_timeout=${budget.busyMs()}`);
      return await action(budget);
    } catch (error) {
      failure = safeFailure(error);
      return { ok: false, error: failure };
    } finally {
      if (acquired) {
        try {
          if (this.#db.isTransaction) this.#db.exec('ROLLBACK');
          this.#db.exec('PRAGMA query_only=OFF; PRAGMA busy_timeout=40');
          if (failure && fatal(failure.code)) this.#db.close();
        } catch {
          // Cleanup is not cancellable; never reuse a connection with unknown state.
          if (this.#db.isOpen) this.#db.close();
        } finally {
          this.#active = false;
        }
      }
    }
  }

  checkSchema(
    options: OperationOptions,
  ): Promise<Result<SchemaStatus, StorageFailure>> {
    return this.#exclusive(options, (budget) => {
      this.#db.exec('BEGIN');
      const status = inspect(this.#db, this.#migrations, budget);
      this.#db.exec('ROLLBACK');
      return { ok: true, value: status };
    });
  }

  migrate(options: OperationOptions): Promise<Result<void, StorageFailure>> {
    return this.#exclusive(options, (budget) => {
      this.#db.exec('BEGIN IMMEDIATE');
      applyMigrations(this.#db, this.#migrations, budget);
      budget.check();
      this.#db.exec('COMMIT');
      // Once COMMIT succeeds, a late deadline must not turn it into a rollback claim.
      return { ok: true, value: undefined };
    });
  }

  readSnapshot<T>(
    read: (scope: SqlScope) => Promise<T>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure>> {
    return this.#scoped(
      false,
      async (scope) => ({ ok: true, value: await read(scope) }),
      options,
    );
  }

  transact<T, E>(
    write: (scope: SqlScope) => Promise<Result<T, E>>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure | OwnerFailure<E>>> {
    return this.#scoped(true, write, options);
  }

  #scoped<T>(
    write: false,
    callback: (scope: SqlScope) => Promise<Result<T, never>>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure>>;
  #scoped<T, E>(
    write: true,
    callback: (scope: SqlScope) => Promise<Result<T, E>>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure | OwnerFailure<E>>>;
  #scoped<T, E>(
    write: boolean,
    callback: (scope: SqlScope) => Promise<Result<T, E>>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure | OwnerFailure<E>>> {
    return this.#exclusive<T, OwnerFailure<E>>(options, async (budget) => {
      let live = true;
      let poison: StorageFailure | undefined;
      const check = () => {
        if (!live) throw new StorageError('scope_ended');
        if (poison) throw new StorageError(poison.code);
        budget.check();
        if (!this.#db.isTransaction) throw new StorageError('sql_failed');
      };
      const execute = <V>(sql: string, action: () => V): V => {
        try {
          check();
          if (!/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql))
            throw new StorageError('sql_failed');
          this.#db.exec(`PRAGMA busy_timeout=${budget.busyMs()}`);
          const value = action();
          check();
          return value;
        } catch (error) {
          poison ??= safeFailure(error);
          throw new StorageError(poison.code);
        }
      };
      const scope: SqlScope = Object.freeze({
        all: (sql: string, params: readonly SqlValue[] = []) =>
          execute(sql, () => {
            const statement = this.#db.prepare(sql);
            statement.setReturnArrays(true);
            statement.setReadBigInts(true);
            return statement
              .all(...params.map(bind))
              .map((row) => Object.values(row).map(cell));
          }),
        run: (sql: string, params: readonly SqlValue[] = []) =>
          execute(sql, () => {
            const statement = this.#db.prepare(sql);
            statement.setReadBigInts(true);
            const result = statement.run(...params.map(bind));
            const changes = Number(result.changes);
            if (!Number.isSafeInteger(changes))
              throw new StorageError('sql_failed');
            return { changes, lastInsertRowid: BigInt(result.lastInsertRowid) };
          }),
      });
      try {
        this.#db.exec(
          write
            ? 'PRAGMA query_only=OFF; BEGIN IMMEDIATE'
            : 'PRAGMA query_only=ON; BEGIN',
        );
        if (inspect(this.#db, this.#migrations, budget).pending !== 0)
          throw new StorageError('incompatible');
        let result: Result<T, E>;
        try {
          result = await callback(scope);
        } catch {
          // Owner exceptions may have code/errcode fields too. Only SQL recorded
          // by this scope is a driver failure; never classify arbitrary callbacks.
          throw new StorageError(poison?.code ?? 'callback_failed');
        }
        check();
        if (!result.ok) {
          this.#db.exec('ROLLBACK');
          return { ok: false, error: { kind: 'owner', error: result.error } };
        }
        this.#db.exec('COMMIT');
        return result;
      } catch (error) {
        // A caught SQL error still poisons the entire transaction.
        throw poison ? new StorageError(poison.code) : error;
      } finally {
        live = false;
      }
    });
  }

  backupTo(
    path: string,
    options: OperationOptions,
  ): Promise<Result<void, StorageFailure>> {
    return this.#exclusive(options, async (budget) => {
      if (typeof path !== 'string' || !path || path.includes('\0'))
        throw new StorageError('incompatible');
      const target = resolve(path);
      privateDirectory(dirname(target));
      const temporary = mkdtempSync(join(dirname(target), '.state-backup-'));
      try {
        const file = join(temporary, 'backup.db');
        closeSync(openSync(file, 'wx', 0o600));
        budget.check();
        // Await native completion even on cancellation; never publish a partial backup.
        await backup(this.#db, file, { progress: () => budget.check() });
        budget.check();
        privateFile(file);
        // Atomic no-replace publication on the same filesystem. Existing targets survive.
        linkSync(file, target);
        return { ok: true, value: undefined };
      } finally {
        rmSync(temporary, { recursive: true, force: true });
      }
    });
  }
}
