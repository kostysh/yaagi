import type { Result } from '@polyphony/core-types';
import type { OperationOptions } from '@polyphony/state/contracts';
import { z } from 'zod';
import type {
  Codec,
  JsonValue,
  QueueCode,
  QueueFailure,
} from '../contracts.js';
import type { StoredJob } from '../ports.js';

export const ok = <T>(value: T): Result<T, QueueFailure> => ({
  ok: true,
  value,
});
export const fail = (code: QueueCode): Result<never, QueueFailure> => ({
  ok: false,
  error: { code },
});
export class QueueError extends Error {
  readonly code: QueueCode;
  constructor(code: QueueCode) {
    super(code);
    this.code = code;
  }
}
export function unwrap<T>(result: Result<T, QueueFailure>): T {
  if (!result.ok) throw new QueueError(result.error.code);
  return result.value;
}
export async function safely<T>(
  action: () => Promise<T>,
): Promise<Result<T, QueueFailure>> {
  try {
    return ok(await action());
  } catch (error) {
    return fail(error instanceof QueueError ? error.code : 'storage');
  }
}
export const name = z.string().min(1);
export const integer = z.number().int().safe();
export const time = integer.min(0).max(8_640_000_000_000_000);
export const duration = integer.min(1).max(2_147_483_647);
export const policy = z.strictObject({
  maxAttempts: integer.min(1),
  timeoutMs: duration,
  backoffMs: integer.min(0).max(2_147_483_647),
});
export const receipt = z.strictObject({
  id: name,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  attemptsUsed: integer.min(0),
});
export const processing = z.strictObject({
  concurrency: integer.min(1),
  windowMs: duration.optional(),
  shutdownMs: duration,
});
export const terminal = (status: StoredJob['status']) =>
  status === 'completed' || status === 'failed' || status === 'cancelled';

export class Budget {
  readonly signal: OperationOptions['signal'];
  private readonly until: number;
  constructor(options: OperationOptions) {
    if (
      !options ||
      !duration.safeParse(options.timeoutMs).success ||
      typeof options.signal?.aborted !== 'boolean' ||
      typeof options.signal.addEventListener !== 'function' ||
      typeof options.signal.removeEventListener !== 'function'
    )
      throw new QueueError('invalid');
    this.signal = options.signal;
    this.until = performance.now() + options.timeoutMs;
    this.check();
  }
  check(): void {
    if (this.signal.aborted) throw new QueueError('cancelled');
    if (performance.now() >= this.until) throw new QueueError('deadline');
  }
  options(): OperationOptions {
    this.check();
    return {
      signal: this.signal,
      timeoutMs: Math.max(1, Math.ceil(this.until - performance.now())),
    };
  }
}
export function internalOptions(): OperationOptions {
  return { signal: new AbortController().signal, timeoutMs: 5_000 };
}

// Canonical, detached JSON is also the boundary against getters, executable values
// and a caller mutating its input after enqueue. No JSON.stringify silent coercion.
export function json(value: unknown, seen = new Set<object>()): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || value === null || seen.has(value))
    throw new QueueError('invalid');
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    throw new QueueError('invalid');
  seen.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(value).length)
      throw new QueueError('invalid');
    if (Array.isArray(value)) {
      if (Object.keys(descriptors).length !== value.length + 1)
        throw new QueueError('invalid');
      return Array.from({ length: value.length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
          throw new QueueError('invalid');
        return json(descriptor.value, seen);
      });
    }
    return Object.fromEntries(
      Object.keys(descriptors)
        .sort()
        .map((key) => {
          const descriptor = descriptors[key];
          if (!('value' in descriptor) || !descriptor.enumerable)
            throw new QueueError('invalid');
          return [key, json(descriptor.value, seen)];
        }),
    );
  } finally {
    seen.delete(value);
  }
}

// Bounded waiting does not cancel its work. The caller must retain resource
// ownership when this returns false, and retry after the actual work settles.
export async function within(
  work: Promise<unknown>,
  budget: Budget,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  try {
    const options = budget.options();
    return await Promise.race([
      work.then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => {
        abort = () => resolve(false);
        options.signal.addEventListener('abort', abort, { once: true });
        timer = setTimeout(abort, options.timeoutMs);
        if (options.signal.aborted) abort();
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    budget.signal.removeEventListener('abort', abort);
  }
}
export function decode<T>(
  codec: Codec<T>,
  value: unknown,
  error: 'invalid' | 'corrupt' = 'invalid',
): T {
  try {
    const result = codec(value);
    if (result.ok) {
      json(result.value);
      return result.value;
    }
  } catch {
    /* Codec errors are not a public error payload. */
  }
  throw new QueueError(error);
}
export async function fingerprint(input: {
  name: string;
  version: number;
  payload: unknown;
  policy: unknown;
  notBefore: number;
}): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(json(input)));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

const attempt = z.strictObject({
  number: integer.min(1),
  startedAt: time,
  finishedAt: time.nullable(),
  status: z.enum(['running', 'completed', 'failed']),
  reason: z
    .enum([
      'handler_failed',
      'invalid_result',
      'interrupted',
      'timeout',
      'stopped',
      'cancelled',
      'lease_lost',
    ])
    .nullable(),
  token: name,
});
const stored = z
  .strictObject({
    schemaVersion: z.literal(1),
    namespace: name,
    id: name,
    name,
    version: integer.min(1),
    hash: receipt.shape.hash,
    status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
    policy,
    notBefore: time,
    requestedNotBefore: time,
    payload: z.json(),
    result: z.union([
      z.strictObject({ available: z.literal(false) }),
      z.strictObject({ available: z.literal(true), value: z.json() }),
    ]),
    cleaned: z.boolean(),
    attempts: z.array(attempt),
    lease: z.strictObject({ token: name, lockedAt: time }).nullable(),
  })
  .superRefine((row, context) => {
    const last = row.attempts.at(-1);
    const bad =
      row.attempts.length > row.policy.maxAttempts ||
      new Set(row.attempts.map((entry) => entry.token)).size !==
        row.attempts.length ||
      row.attempts.some(
        (entry, index) =>
          entry.number !== index + 1 ||
          (entry.status === 'running'
            ? entry.finishedAt !== null ||
              entry.reason !== null ||
              index !== row.attempts.length - 1
            : entry.finishedAt === null ||
              entry.finishedAt < entry.startedAt) ||
          (entry.status === 'completed' &&
            (entry.reason !== null ||
              row.status !== 'completed' ||
              index !== row.attempts.length - 1)) ||
          (entry.status === 'failed' && entry.reason === null),
      ) ||
      (row.status === 'running') !== (last?.status === 'running') ||
      (row.status === 'running' &&
        (!row.lease || last?.token !== row.lease.token)) ||
      (row.status === 'pending' &&
        row.attempts.length >= row.policy.maxAttempts) ||
      (row.status === 'pending' &&
        row.lease !== null &&
        row.attempts.some((entry) => entry.token === row.lease?.token)) ||
      (row.status === 'failed' &&
        (row.attempts.length !== row.policy.maxAttempts ||
          last?.status !== 'failed')) ||
      (row.status === 'completed' && last?.status !== 'completed') ||
      (terminal(row.status) && row.lease !== null) ||
      row.result.available !== (row.status === 'completed' && !row.cleaned) ||
      (row.cleaned && (!terminal(row.status) || row.payload !== null)) ||
      row.notBefore < row.requestedNotBefore;
    if (bad)
      context.addIssue({
        code: 'custom',
        message: 'Invalid persisted invariant',
      });
  });
export async function record(
  value: unknown,
  namespace: string,
  id?: string,
): Promise<StoredJob | undefined> {
  if (value === undefined) return undefined;
  const parsed = stored.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.namespace !== namespace ||
    (id !== undefined && parsed.data.id !== id)
  )
    throw new QueueError('corrupt');
  const row = parsed.data;
  if (
    !row.cleaned &&
    row.hash !==
      (await fingerprint({
        name: row.name,
        version: row.version,
        payload: row.payload,
        policy: row.policy,
        notBefore: row.requestedNotBefore,
      }))
  )
    throw new QueueError('corrupt');
  return row;
}
