import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { Result } from '@polyphony/core-types';
import { createState } from '@polyphony/state';
import { createSqliteAdapter } from '@polyphony/state/adapters/sqlite';
import type { OperationOptions, StoragePort } from '@polyphony/state/contracts';
import { createQueue, defineJob } from '@polyphony/queue';
import type {
  Codec,
  Context,
  Queue,
  Registration,
} from '@polyphony/queue/contracts';
import type {
  QueueAdapter,
  QueueScope,
  StoredJob,
} from '@polyphony/queue/ports';
import { createAgendaAdapter } from '@polyphony/queue/adapters/agenda';
import {
  bindQueueScope,
  loadQueueMigrations,
} from '@polyphony/queue/storage/sqlite';

export const limits = (timeoutMs = 5_000): OperationOptions => ({
  signal: new AbortController().signal,
  timeoutMs,
});
export function required<T, E>(result: Result<T, E>): T {
  assert.ok(result.ok, JSON.stringify(result));
  return result.value;
}
export const number: Codec<number> = (value) =>
  typeof value === 'number' && Number.isFinite(value)
    ? { ok: true, value }
    : { ok: false, error: { code: 'invalid' } };
export const job = (
  handler: (value: number, context: Context) => Promise<number> = async (
    value,
  ) => value * 10 + 2,
) =>
  required(
    defineJob({
      name: 'work',
      version: 1,
      payload: number,
      result: number,
      handler,
    }),
  );
export const policy = { maxAttempts: 3, backoffMs: 0, timeoutMs: 5_000 };
export const startOptions = { concurrency: 1, shutdownMs: 2_000 };
export const agenda = (leaseMs = 2_000) =>
  required(createAgendaAdapter({ pollIntervalMs: 20, leaseMs }));
export const deferred = <T = void>() => Promise.withResolvers<T>();

export type Hooks = {
  beforePut?: (row: StoredJob) => Promise<void>;
  afterCommit?: (row: StoredJob) => Promise<void>;
  loseReply?: (row: StoredJob) => boolean;
  beforeCandidate?: () => Promise<void>;
};
export async function open(path: string, hooks: Hooks = {}) {
  const adapter = required(
    await createSqliteAdapter(
      { path, migrations: await loadQueueMigrations() },
      limits(),
    ),
  );
  const base = createState(adapter, bindQueueScope);
  const raw = createState(adapter, (scope) => scope);
  required(await base.migrate(limits()));
  const events = new EventEmitter();
  const storage: StoragePort<QueueScope> = {
    ...base,
    transact: async (write, options) => {
      const writes: StoredJob[] = [];
      const result = await base.transact(
        (scope) =>
          write({
            ...scope,
            put: async (row) => {
              await hooks.beforePut?.(row);
              await scope.put(row);
              writes.push(row);
            },
            candidate: async (...args) => {
              await hooks.beforeCandidate?.();
              return scope.candidate(...args);
            },
          }),
        options,
      );
      if (result.ok)
        for (const row of writes) {
          events.emit('commit', row);
          await hooks.afterCommit?.(row);
          if (hooks.loseReply?.(row))
            return {
              ok: false,
              error: { kind: 'storage', code: 'unavailable' },
            };
        }
      return result;
    },
  };
  const queues: Queue[] = [];
  const make = (
    registration: Registration<number, number> = job(),
    processing: QueueAdapter = agenda(),
    namespace = 'tests',
    port = storage,
  ) => {
    const queue = required(
      createQueue({
        namespace,
        storage: port,
        adapter: {
          ...processing,
          start: (input) =>
            processing.start({
              ...input,
              onError: (failure) => {
                events.emit('fault', failure);
                input.onError(failure);
              },
            }),
        },
        registrations: [registration],
      }),
    );
    queues.push(queue);
    return queue;
  };
  const committed = (predicate: (row: StoredJob) => boolean) =>
    new Promise<StoredJob>((resolve, reject) => {
      const failed = (failure: unknown) => {
        events.off('commit', listener);
        events.off('fault', failed);
        reject(
          new Error(
            `Dispatch failed before expected commit: ${JSON.stringify(failure)}`,
          ),
        );
      };
      const listener = (row: StoredJob) => {
        if (predicate(row)) {
          events.off('commit', listener);
          events.off('fault', failed);
          resolve(row);
        }
      };
      events.on('commit', listener);
      events.on('fault', failed);
    });
  return {
    path,
    adapter,
    base,
    storage,
    raw,
    hooks,
    make,
    committed,
    close: async () => {
      for (const queue of queues) required(await queue.stop(limits()));
      required(await base.close());
    },
  };
}
export async function fixture(t: TestContext, hooks: Hooks = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'polyphony-queue-'));
  const root = await open(join(directory, 'queue.db'), hooks);
  t.after(async () => {
    await root.close();
    await rm(directory, { recursive: true, force: true });
  });
  return root;
}
export async function enqueue(
  queue: Queue,
  registration: Registration<number, number>,
  id = 'a',
  maxAttempts = 3,
  notBefore = 0,
) {
  return required(
    await queue.enqueue(
      registration.type,
      { id, payload: 4, policy: { ...policy, maxAttempts }, notBefore },
      limits(),
    ),
  );
}
export const terminal = (row: StoredJob): boolean =>
  ['completed', 'cancelled', 'failed'].includes(row.status);
