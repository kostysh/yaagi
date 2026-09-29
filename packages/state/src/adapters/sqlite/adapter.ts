import { resolve } from 'node:path';
import type { Result } from '@polyphony/core-types';
import type {
  OperationOptions,
  SchemaStatus,
  StorageFailure,
  StorageSession,
} from '../../contracts.js';
import { Budget } from '../../internal/budget.js';
import { coreFailure, StorageError } from '../../internal/errors.js';
import type { SqliteAdapter, SqlScope, SqlValue } from '../sqlite.js';
import { Channel } from './channel.js';
import { fatal, safeFailure } from './errors.js';
import type { Config, Job, Payload } from './protocol.js';

export async function openAdapter(
  config: Config,
  budget: Budget,
): Promise<Result<SqliteAdapter, StorageFailure>> {
  if (process.platform !== 'linux' || process.arch !== 'x64')
    return { ok: false, error: { kind: 'storage', code: 'incompatible' } };
  const adapter = new SqliteStorageAdapter({
    ...config,
    path: resolve(config.path),
  });
  const opened = await adapter.oneShot('open', budget.options());
  return opened.ok ? { ok: true, value: adapter } : opened;
}

class SqliteStorageAdapter implements SqliteAdapter {
  readonly #config: Config;
  readonly #active = new Set<Promise<void>>();
  #closed = false;
  constructor(config: Config) {
    this.#config = config;
  }
  #start(job: Job, budget: Budget, target?: string): Channel {
    budget.check();
    if (this.#closed) throw new StorageError('closed');
    const channel = new Channel(
      {
        config: this.#config,
        job,
        end: budget.end,
        ...(target === undefined ? {} : { target }),
      },
      budget,
    );
    this.#active.add(channel.done);
    void channel.done.then(() => this.#active.delete(channel.done));
    return channel;
  }
  #record(error: StorageFailure): StorageFailure {
    if (fatal(error.code)) this.#closed = true;
    return error;
  }
  async oneShot(
    job: 'open' | 'check' | 'migrate' | 'backup',
    options: OperationOptions,
    target?: string,
  ): Promise<Result<Payload, StorageFailure>> {
    try {
      const channel = this.#start(job, new Budget(options), target);
      const result = await channel.ready;
      await channel.done;
      return result.ok
        ? result
        : { ok: false, error: this.#record(result.error) };
    } catch (error) {
      return { ok: false, error: this.#record(safeFailure(error)) };
    }
  }
  async checkSchema(
    options: OperationOptions,
  ): Promise<Result<SchemaStatus, StorageFailure>> {
    const result = await this.oneShot('check', options);
    if (!result.ok) return result;
    return result.value.kind === 'schema'
      ? { ok: true, value: result.value.status }
      : { ok: false, error: coreFailure(undefined) };
  }
  async migrate(
    options: OperationOptions,
  ): Promise<Result<void, StorageFailure>> {
    const result = await this.oneShot('migrate', options);
    return result.ok ? { ok: true, value: undefined } : result;
  }
  async backupTo(
    path: string,
    options: OperationOptions,
  ): Promise<Result<void, StorageFailure>> {
    const result = await this.oneShot('backup', options, path);
    return result.ok ? { ok: true, value: undefined } : result;
  }
  async begin(
    mode: 'snapshot' | 'transaction',
    options: OperationOptions,
  ): Promise<Result<StorageSession<SqlScope>, StorageFailure>> {
    try {
      const budget = new Budget(options);
      const channel = this.#start(mode, budget);
      const ready = await channel.ready;
      if (!ready.ok) {
        await channel.done;
        return { ok: false, error: this.#record(ready.error) };
      }
      let live = true;
      let poison: StorageFailure | undefined;
      let ending: Promise<Result<void, StorageFailure>> | undefined;
      const execute = async (
        kind: 'all' | 'run',
        sql: string,
        params: readonly SqlValue[],
      ) => {
        if (!live) throw new StorageError('scope_ended');
        try {
          if (poison) throw new StorageError(poison.code);
          budget.check();
          const result = await channel.request({ kind, sql, params });
          if (!result.ok) {
            poison ??= this.#record(result.error);
            throw new StorageError(poison.code);
          }
          budget.check();
          return result.value;
        } catch (error) {
          poison ??= this.#record(coreFailure(error));
          throw new StorageError(poison.code);
        }
      };
      const scope: SqlScope = Object.freeze({
        all: async (sql: string, params: readonly SqlValue[] = []) => {
          const result = await execute('all', sql, params);
          if (result.kind !== 'rows')
            throw new StorageError('operation_failed');
          return result.rows;
        },
        run: async (sql: string, params: readonly SqlValue[] = []) => {
          const result = await execute('run', sql, params);
          if (result.kind !== 'run') throw new StorageError('operation_failed');
          return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
          };
        },
      });
      return {
        ok: true,
        value: {
          scope,
          get failure() {
            return poison;
          },
          finish: (outcome) => {
            if (ending) return ending;
            live = false;
            if (outcome === 'commit' && !poison) {
              try {
                budget.check();
              } catch (error) {
                poison = coreFailure(error);
              }
            }
            ending = (async () => {
              const result = await channel.request({
                kind: 'finish',
                outcome: poison ? 'rollback' : outcome,
              });
              await channel.done;
              if (!result.ok)
                return { ok: false, error: this.#record(result.error) };
              return poison
                ? { ok: false, error: poison }
                : { ok: true, value: undefined };
            })();
            return ending;
          },
        },
      };
    } catch (error) {
      return { ok: false, error: this.#record(safeFailure(error)) };
    }
  }
  async close(): Promise<Result<void, StorageFailure>> {
    this.#closed = true;
    await Promise.all(this.#active);
    return { ok: true, value: undefined };
  }
}
