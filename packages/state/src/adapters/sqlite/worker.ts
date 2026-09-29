import { closeSync, linkSync, mkdtempSync, openSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { parentPort, workerData } from 'node:worker_threads';
import { load } from 'sqlite-vec';
import type { StorageFailure } from '../../contracts.js';
import { Budget } from '../../internal/budget.js';
import { StorageError } from '../../internal/errors.js';
import type { SqlValue } from '../sqlite.js';
import { safeFailure } from './errors.js';
import { databaseFiles, privateDirectory, privateFile } from './files.js';
import { applyMigrations, inspect } from './migrations.js';
import type { Command, Payload, Reply, Start } from './protocol.js';

const start = workerData as Start;
const port = parentPort;
if (!port) throw new Error('SQLite worker requires its adapter');
const cancelled = new Int32Array(start.cancelled);
let db: DatabaseSync | undefined;
let budget: Budget;
let poison: StorageFailure | undefined;
let committed = false;

function busyMs(): number {
  return Math.max(
    1,
    Math.min(2147483647, Math.ceil(budget.options().timeoutMs)),
  );
}

function mapped(error: unknown): StorageFailure {
  const result = safeFailure(error);
  if (result.code === 'busy') {
    try {
      budget.check();
    } catch (expired) {
      return safeFailure(expired);
    }
  }
  return result;
}
function cleanup(): void {
  if (!db?.isOpen) return;
  try {
    if (db.isTransaction) db.exec('ROLLBACK');
  } finally {
    db.close();
  }
}
function reply(id: number, result: Reply['result']): void {
  port?.postMessage({ id, result } satisfies Reply);
}
function terminal(id: number, action: () => Payload): void {
  let result: Reply['result'];
  try {
    result = { ok: true, value: action() };
  } catch (error) {
    result = { ok: false, error: poison ?? mapped(error) };
  }
  try {
    cleanup();
  } catch (error) {
    // A successful COMMIT cannot be reported as rolled back by a later close error.
    if (result.ok && !committed) result = { ok: false, error: mapped(error) };
  }
  reply(id, result);
  port?.close();
}
function check(): DatabaseSync {
  if (poison) throw new StorageError(poison.code);
  budget.check();
  databaseFiles(start.config.path);
  if (!db?.isTransaction) throw new StorageError('operation_failed');
  db.exec(`PRAGMA busy_timeout=${busyMs()}`);
  return db;
}
function bind(value: SqlValue): SqlValue {
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new StorageError('operation_failed');
  if (typeof value === 'bigint' && (value < -(1n << 63n) || value >= 1n << 63n))
    throw new StorageError('operation_failed');
  if (value instanceof Uint8Array) return value;
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  )
    return value;
  throw new StorageError('operation_failed');
}
function cell(value: SqlValue): SqlValue {
  if (
    typeof value === 'bigint' &&
    value >= BigInt(Number.MIN_SAFE_INTEGER) &&
    value <= BigInt(Number.MAX_SAFE_INTEGER)
  )
    return Number(value);
  return value;
}
function command(message: Command): void {
  if (message.kind === 'finish') {
    terminal(message.id, () => {
      if (message.outcome === 'commit') {
        check().exec('COMMIT');
        committed = true;
      } else if (db?.isTransaction) db.exec('ROLLBACK');
      if (poison) throw new StorageError(poison.code);
      return { kind: 'done' };
    });
    return;
  }
  try {
    const connection = check();
    if (!/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(message.sql))
      throw new StorageError('operation_failed');
    const statement = connection.prepare(message.sql);
    statement.setReadBigInts(true);
    let value: Payload;
    if (message.kind === 'all') {
      statement.setReturnArrays(true);
      value = {
        kind: 'rows',
        rows: statement
          .all(...message.params.map(bind))
          .map((row) => Object.values(row).map(cell)),
      };
    } else {
      const result = statement.run(...message.params.map(bind));
      const changes = Number(result.changes);
      if (!Number.isSafeInteger(changes))
        throw new StorageError('operation_failed');
      value = {
        kind: 'run',
        changes,
        lastInsertRowid: BigInt(result.lastInsertRowid),
      };
    }
    check();
    reply(message.id, { ok: true, value });
  } catch (error) {
    poison ??= mapped(error);
    reply(message.id, { ok: false, error: poison });
  }
}
function scalar(connection: DatabaseSync, sql: string): unknown {
  return Object.values(connection.prepare(sql).get() ?? {})[0];
}
async function startWorker(): Promise<void> {
  budget = new Budget(
    {
      signal: {
        get aborted() {
          return Atomics.load(cancelled, 0) !== 0;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      },
      timeoutMs: 1,
    },
    start.end,
  );
  const { path, migrations } = start.config;
  privateDirectory(dirname(path));
  databaseFiles(path, start.job === 'open');
  privateFile(path, start.job === 'open');
  budget.check();
  db = new DatabaseSync(path, {
    timeout: busyMs(),
    allowExtension: true,
  });
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
  db.exec(`PRAGMA busy_timeout=${busyMs()}`);
  if (start.job === 'transaction' || start.job === 'migrate')
    db.exec('BEGIN IMMEDIATE');
  else db.exec('PRAGMA query_only=ON; BEGIN');
  if (start.job === 'migrate') {
    terminal(0, () => {
      if (!db) throw new StorageError('closed');
      applyMigrations(db, migrations, budget);
      check().exec('COMMIT');
      committed = true;
      return { kind: 'done' };
    });
    return;
  }
  const status = inspect(db, migrations, budget);
  if (start.job === 'snapshot' || start.job === 'transaction') {
    if (status.pending) throw new StorageError('incompatible');
    port?.on('message', command);
    reply(0, { ok: true, value: { kind: 'ready' } });
    return;
  }
  if (start.job === 'backup') {
    if (
      typeof start.target !== 'string' ||
      !start.target ||
      start.target.includes('\0')
    )
      throw new StorageError('incompatible');
    const target = resolve(start.target);
    privateDirectory(dirname(target));
    const temporary = mkdtempSync(join(dirname(target), '.state-backup-'));
    try {
      const file = join(temporary, 'backup.db');
      closeSync(openSync(file, 'wx', 0o600));
      budget.check();
      await backup(db, file, { progress: () => budget.check() });
      budget.check();
      privateFile(file);
      linkSync(file, target);
      committed = true;
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  terminal(0, () => ({ kind: 'schema', status }));
}
try {
  await startWorker();
} catch (error) {
  terminal(0, () => {
    throw error;
  });
}
