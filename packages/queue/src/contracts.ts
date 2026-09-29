import type { Result } from '@polyphony/core-types';
import type { OperationOptions } from '@polyphony/state/contracts';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export type QueueCode =
  | 'invalid'
  | 'unknown_job'
  | 'not_found'
  | 'conflict'
  | 'corrupt'
  | 'storage'
  | 'unknown_commit'
  | 'cancelled'
  | 'deadline'
  | 'already_running'
  | 'stopping'
  | 'stop_incomplete'
  | 'adapter';
export type QueueFailure = { readonly code: QueueCode };
export type Codec<T> = (value: unknown) => Result<T, { code: 'invalid' }>;
export interface JobType<P, R> {
  readonly name: string;
  readonly version: number;
  readonly payload: Codec<P>;
  readonly result: Codec<R>;
}
export type JobPolicy = {
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly timeoutMs: number;
};
export type Context = {
  readonly id: string;
  readonly namespace: string;
  readonly attempt: number;
  readonly signal: OperationOptions['signal'];
  readonly timeoutMs: number;
};
export interface Registration<P, R> {
  readonly type: JobType<P, R>;
  readonly invoke: (payload: unknown, context: Context) => Promise<unknown>;
}
export type FailureReason =
  | 'handler_failed'
  | 'invalid_result'
  | 'interrupted'
  | 'timeout'
  | 'stopped'
  | 'cancelled'
  | 'lease_lost';
export type Attempt = {
  readonly number: number;
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly status: 'running' | 'completed' | 'failed';
  readonly reason: FailureReason | null;
};
export type Status =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type RetainedResult<R> =
  | { readonly available: true; readonly value: R }
  | { readonly available: false };
export type Enqueued = {
  readonly id: string;
  readonly hash: string;
  readonly duplicate: boolean;
};
export type JobStatus<R> = {
  readonly id: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: number;
  readonly hash: string;
  readonly status: Status;
  readonly attemptsUsed: number;
  readonly maxAttempts: number;
  readonly notBefore: number;
  readonly attempts: readonly Attempt[];
  readonly result: RetainedResult<R>;
  readonly cleaned: boolean;
};
export type ProcessingOptions = {
  readonly concurrency: number;
  readonly windowMs?: number;
  readonly shutdownMs: number;
};
export interface Queue {
  enqueue<P, R>(
    type: JobType<P, R>,
    input: { id: string; payload: P; policy: JobPolicy; notBefore?: number },
    options: OperationOptions,
  ): Promise<Result<Enqueued, QueueFailure>>;
  get<P, R>(
    type: JobType<P, R>,
    id: string,
    options: OperationOptions,
  ): Promise<Result<JobStatus<R>, QueueFailure>>;
  cancel(
    id: string,
    options: OperationOptions,
  ): Promise<Result<void, QueueFailure>>;
  cleanup(
    receipt: { id: string; hash: string; attemptsUsed: number },
    options: OperationOptions,
  ): Promise<Result<void, QueueFailure>>;
  start(
    input: ProcessingOptions,
    options: OperationOptions,
  ): Promise<Result<void, QueueFailure>>;
  stop(options: OperationOptions): Promise<Result<void, QueueFailure>>;
  lifecycle(): { state: 'idle' | 'running' | 'stopping'; error?: QueueFailure };
}
