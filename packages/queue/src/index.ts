import type { Result } from '@polyphony/core-types';
import type { OperationOptions, StoragePort } from '@polyphony/state/contracts';
import type {
  Context,
  FailureReason,
  JobStatus,
  JobType,
  Queue,
  QueueFailure,
  Registration,
} from './contracts.js';
import type { Delivery, QueueAdapter, QueueScope, StoredJob } from './ports.js';
import {
  Budget,
  decode,
  fail,
  fingerprint,
  internalOptions,
  integer,
  json,
  name,
  ok,
  policy,
  processing,
  QueueError,
  receipt,
  safely,
  terminal,
  time,
  unwrap,
  within,
} from './internal/model.js';
import { Store, typeKey } from './internal/store.js';

export function defineJob<P, R>(
  input: JobType<P, R> & {
    handler: (payload: P, context: Context) => Promise<R>;
  },
): Result<Registration<P, R>, QueueFailure> {
  try {
    if (
      !input ||
      !name.safeParse(input.name).success ||
      !integer.min(1).safeParse(input.version).success ||
      typeof input.payload !== 'function' ||
      typeof input.result !== 'function' ||
      typeof input.handler !== 'function'
    )
      return fail('invalid');
    const type = Object.freeze({
      name: input.name,
      version: input.version,
      payload: input.payload,
      result: input.result,
    });
    const handler = input.handler;
    return ok(
      Object.freeze({
        type,
        invoke: async (value: unknown, context: Context) => {
          const deadline = Date.now() + context.timeoutMs;
          const payload = decode(type.payload, value);
          // Core supplies a live remaining budget; a standalone invocation may
          // supply a static one. Neither may gain time while its codec runs.
          const timeoutMs = Math.min(context.timeoutMs, deadline - Date.now());
          if (context.signal.aborted) throw new QueueError('cancelled');
          if (timeoutMs <= 0) throw new QueueError('deadline');
          return handler(payload, { ...context, timeoutMs });
        },
      }),
    );
  } catch {
    return fail('invalid');
  }
}

export function createQueue(input: {
  namespace: string;
  registrations: readonly Registration<unknown, unknown>[];
  storage: StoragePort<QueueScope>;
  adapter: QueueAdapter;
}): Result<Queue, QueueFailure> {
  try {
    if (
      !input ||
      !name.safeParse(input.namespace).success ||
      !Array.isArray(input.registrations) ||
      !input.registrations.length ||
      typeof input.storage?.transact !== 'function' ||
      typeof input.storage.readSnapshot !== 'function' ||
      typeof input.storage.checkSchema !== 'function' ||
      typeof input.adapter?.start !== 'function' ||
      typeof input.adapter.stop !== 'function'
    )
      return fail('invalid');
    const registrations = new Map<string, Registration<unknown, unknown>>();
    for (const registration of input.registrations) {
      const type = registration?.type;
      if (
        !type ||
        !name.safeParse(type.name).success ||
        !integer.min(1).safeParse(type.version).success ||
        typeof type.payload !== 'function' ||
        typeof type.result !== 'function' ||
        typeof registration.invoke !== 'function'
      )
        return fail('invalid');
      const key = typeKey(type.name, type.version);
      if (registrations.has(key)) return fail('invalid');
      registrations.set(key, registration);
    }
    return ok(
      build(input.namespace, registrations, input.storage, input.adapter),
    );
  } catch {
    return fail('invalid');
  }
}

function build(
  namespace: string,
  registrations: ReadonlyMap<string, Registration<unknown, unknown>>,
  storage: StoragePort<QueueScope>,
  adapter: QueueAdapter,
): Queue {
  let state: 'idle' | 'running' | 'stopping' = 'idle';
  let error: QueueFailure | undefined;
  let startup: Promise<void> | undefined;
  let windowTimer: ReturnType<typeof setTimeout> | undefined;
  let windowEnd = Number.POSITIVE_INFINITY;
  let shutdownMs = 5_000;
  const controllers = new Map<
    string,
    { id: string; abort: (reason: FailureReason) => void }
  >();
  const store = new Store(
    namespace,
    storage,
    registrations,
    () => state === 'running' && !error && Date.now() < windowEnd,
  );
  const authorize = <P, R>(type: JobType<P, R>) => {
    if (
      !type ||
      registrations.get(typeKey(type.name, type.version))?.type !== type
    )
      throw new QueueError('unknown_job');
  };
  const fault = (failure: QueueFailure) => {
    error ??= { code: failure.code };
    if (state === 'running')
      void queue.stop({
        signal: new AbortController().signal,
        timeoutMs: shutdownMs,
      });
  };

  async function execute(
    delivery: Delivery,
    signal: OperationOptions['signal'],
  ): Promise<void> {
    const controller = new AbortController();
    let reason: FailureReason | null = null;
    const abort = (why: FailureReason) => {
      reason ??= why;
      controller.abort();
    };
    const forward = () => abort(state === 'running' ? 'lease_lost' : 'stopped');
    controllers.set(delivery.token, { id: delivery.id, abort });
    signal.addEventListener('abort', forward, { once: true });
    if (signal.aborted) forward();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const row = await store.read(delivery.id);
      const attempt = row?.attempts.at(-1);
      if (
        row?.status !== 'running' ||
        row.lease?.token !== delivery.token ||
        !attempt
      )
        return;
      const deadline = Math.min(
        attempt.startedAt + row.policy.timeoutMs,
        windowEnd,
      );
      const remaining = deadline - Date.now();
      if (state !== 'running') abort('stopped');
      if (remaining <= 0) abort('timeout');
      else timer = setTimeout(() => abort('timeout'), remaining);
      let result: StoredJob['result'] = { available: false };
      if (!controller.signal.aborted) {
        const registration = registrations.get(typeKey(row.name, row.version));
        if (!registration) throw new QueueError('corrupt');
        try {
          const value = await registration.invoke(row.payload, {
            id: row.id,
            namespace,
            attempt: attempt.number,
            signal: controller.signal,
            // Keep the absolute attempt/window deadline authoritative across
            // synchronous payload decoding in the registration bridge.
            get timeoutMs() {
              return Math.max(0, deadline - Date.now());
            },
          });
          if (Date.now() >= deadline) abort('timeout');
          if (!controller.signal.aborted) {
            try {
              result = {
                available: true,
                value: json(decode(registration.type.result, value)),
              };
            } catch {
              reason = 'invalid_result';
            }
          }
        } catch {
          if (Date.now() >= deadline) abort('timeout');
          else reason ??= 'handler_failed';
        }
      }
      // Timers cannot preempt synchronous handler/codec work. Recheck the actual
      // deadline after control returns, before accepting its result as successful.
      if (Date.now() >= deadline) {
        abort('timeout');
        result = { available: false };
      }
      clearTimeout(timer);
      // A cooperative abort is not a terminal cancel. Only cancel() changes that
      // state; stop/timeout consume this attempt and retain the remaining budget.
      await store.finish(delivery, {
        result,
        reason: result.available ? null : (reason ?? 'handler_failed'),
      });
    } catch (failure) {
      // Concurrent durable cancel / lease replacement wins the compare-and-set.
      if (!(failure instanceof QueueError && failure.code === 'conflict'))
        fault({
          code: failure instanceof QueueError ? failure.code : 'storage',
        });
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', forward);
      controllers.delete(delivery.token);
    }
  }

  const queue: Queue = {
    enqueue: (type, request, options) =>
      safely(async () => {
        const budget = new Budget(options);
        authorize(type);
        if (
          !request ||
          !name.safeParse(request.id).success ||
          !policy.safeParse(request.policy).success ||
          !time.safeParse(request.notBefore ?? 0).success
        )
          throw new QueueError('invalid');
        const payload = json(decode(type.payload, json(request.payload)));
        const jobPolicy = policy.parse(request.policy);
        const requestedNotBefore = request.notBefore ?? 0;
        const hash = await fingerprint({
          name: type.name,
          version: type.version,
          payload,
          policy: jobPolicy,
          notBefore: requestedNotBefore,
        });
        const created: StoredJob = {
          schemaVersion: 1,
          namespace,
          id: request.id,
          name: type.name,
          version: type.version,
          hash,
          payload,
          policy: jobPolicy,
          notBefore: requestedNotBefore,
          requestedNotBefore,
          status: 'pending',
          attempts: [],
          lease: null,
          cleaned: false,
          result: { available: false },
        };
        return store.mutate(
          request.id,
          (row) => {
            if (row && row.hash !== hash) throw new QueueError('conflict');
            return {
              value: { id: request.id, hash, duplicate: Boolean(row) },
              ...(row ? {} : { next: created }),
            };
          },
          (row) =>
            row?.hash === hash
              ? { value: { id: request.id, hash, duplicate: true } }
              : undefined,
          budget,
        );
      }),
    get: <P, R>(type: JobType<P, R>, id: string, options: OperationOptions) =>
      safely(async (): Promise<JobStatus<R>> => {
        const budget = new Budget(options);
        authorize(type);
        if (!name.safeParse(id).success) throw new QueueError('invalid');
        const row = await store.read(id, budget);
        if (!row) throw new QueueError('not_found');
        if (row.name !== type.name || row.version !== type.version)
          throw new QueueError('conflict');
        return {
          id: row.id,
          namespace,
          name: row.name,
          version: row.version,
          hash: row.hash,
          status: row.status,
          attemptsUsed: row.attempts.length,
          maxAttempts: row.policy.maxAttempts,
          notBefore: row.notBefore,
          attempts: row.attempts.map(
            ({ number, startedAt, finishedAt, status, reason }) => ({
              number,
              startedAt,
              finishedAt,
              status,
              reason,
            }),
          ),
          cleaned: row.cleaned,
          result: row.result.available
            ? {
                available: true,
                value: decode(type.result, row.result.value, 'corrupt'),
              }
            : { available: false },
        };
      }),
    cancel: (id, options) =>
      safely(async () => {
        const budget = new Budget(options);
        if (!name.safeParse(id).success) throw new QueueError('invalid');
        await store.mutate(
          id,
          (row) => {
            if (!row) throw new QueueError('not_found');
            if (row.status === 'cancelled') return { value: undefined };
            if (terminal(row.status)) throw new QueueError('conflict');
            const last = row.attempts.at(-1);
            return {
              value: undefined,
              next: {
                ...row,
                status: 'cancelled',
                lease: null,
                attempts:
                  last?.status === 'running'
                    ? [
                        ...row.attempts.slice(0, -1),
                        {
                          ...last,
                          status: 'failed',
                          reason: 'cancelled',
                          finishedAt: Math.max(Date.now(), last.startedAt),
                        },
                      ]
                    : row.attempts,
              },
            };
          },
          (row) =>
            row?.status === 'cancelled' ? { value: undefined } : undefined,
          budget,
        );
        for (const entry of controllers.values())
          if (entry.id === id) entry.abort('cancelled');
      }),
    cleanup: (input, options) =>
      safely(async () => {
        const budget = new Budget(options);
        if (!receipt.safeParse(input).success) throw new QueueError('invalid');
        await store.mutate(
          input.id,
          (row) => {
            if (!row) throw new QueueError('not_found');
            if (
              !terminal(row.status) ||
              row.hash !== input.hash ||
              row.attempts.length !== input.attemptsUsed
            )
              throw new QueueError('conflict');
            return {
              value: undefined,
              ...(row.cleaned
                ? {}
                : {
                    next: {
                      ...row,
                      cleaned: true,
                      payload: null,
                      result: { available: false as const },
                    },
                  }),
            };
          },
          (row) =>
            row?.cleaned &&
            row.hash === input.hash &&
            row.attempts.length === input.attemptsUsed
              ? { value: undefined }
              : undefined,
          budget,
        );
      }),
    start: (input, options) =>
      safely(async () => {
        const budget = new Budget(options);
        if (!processing.safeParse(input).success)
          throw new QueueError('invalid');
        if (state !== 'idle')
          throw new QueueError(
            state === 'running' ? 'already_running' : 'stopping',
          );
        state = 'running';
        error = undefined;
        shutdownMs = input.shutdownMs;
        windowEnd =
          input.windowMs === undefined
            ? Number.POSITIVE_INFINITY
            : Date.now() + input.windowMs;
        if (input.windowMs !== undefined)
          windowTimer = setTimeout(() => {
            void queue.stop({ ...internalOptions(), timeoutMs: shutdownMs });
          }, input.windowMs);
        startup = (async () => {
          const schema = await storage.checkSchema(budget.options());
          if (!schema.ok || schema.value.pending)
            throw new QueueError('storage');
          budget.check();
          if (state !== 'running') throw new QueueError('stopping');
          unwrap(
            await adapter.start({
              types: [...registrations.values()].map(({ type }) => ({
                name: type.name,
                version: type.version,
              })),
              concurrency: input.concurrency,
              store,
              execute,
              onError: fault,
            }),
          );
        })();
        try {
          await startup;
        } catch (failure) {
          fault({
            code: failure instanceof QueueError ? failure.code : 'adapter',
          });
          throw failure;
        }
      }),
    stop: async (options) => {
      let budget: Budget;
      try {
        budget = new Budget(options);
      } catch (failure) {
        if (!(failure instanceof QueueError) || failure.code === 'invalid')
          return fail('invalid');
        if (state === 'idle') return fail(failure.code);
        state = 'stopping';
        clearTimeout(windowTimer);
        for (const entry of controllers.values()) entry.abort('stopped');
        return fail('stop_incomplete');
      }
      if (state === 'idle') return ok(undefined);
      state = 'stopping';
      clearTimeout(windowTimer);
      for (const entry of controllers.values()) entry.abort('stopped');
      // Startup may have accepted resource acquisition before stop. Never close
      // the adapter under that continuation, even when the caller stops waiting.
      if (
        startup &&
        !(await within(
          startup.catch(() => {}),
          budget,
        ))
      )
        return fail('stop_incomplete');
      try {
        const stopped = await adapter.stop(budget.options());
        if (!stopped.ok) return fail('stop_incomplete');
        budget.check();
        state = 'idle';
        startup = undefined;
        return ok(undefined);
      } catch {
        return fail('stop_incomplete');
      }
    },
    lifecycle: () => ({ state, ...(error ? { error: { ...error } } : {}) }),
  };
  return queue;
}
