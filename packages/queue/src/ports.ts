import type { Result } from '@polyphony/core-types';
import type { OperationOptions } from '@polyphony/state/contracts';
import type {
  Attempt,
  JsonValue,
  JobPolicy,
  QueueFailure,
  RetainedResult,
  Status,
} from './contracts.js';

export type StoredJob = {
  readonly schemaVersion: 1;
  readonly namespace: string;
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly hash: string;
  readonly status: Status;
  readonly policy: JobPolicy;
  readonly notBefore: number;
  readonly requestedNotBefore: number;
  readonly payload: JsonValue;
  readonly result: RetainedResult<JsonValue>;
  readonly cleaned: boolean;
  readonly attempts: readonly (Attempt & { readonly token: string })[];
  readonly lease: { readonly token: string; readonly lockedAt: number } | null;
};
export interface QueueScope {
  get(namespace: string, id: string): Promise<unknown | undefined>;
  put(job: StoredJob): Promise<void>;
  candidate(
    namespace: string,
    name: string,
    version: number,
    through: number,
    lockDeadline: number,
  ): Promise<unknown | undefined>;
}
export type Delivery = {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly token: string;
  readonly notBefore: number;
  readonly lockedAt: number;
};
export interface ProcessingStore {
  reserve(
    name: string,
    version: number,
    through: number,
    lockDeadline: number,
  ): Promise<Result<Delivery | undefined, QueueFailure>>;
  begin(delivery: Delivery): Promise<Result<void, QueueFailure>>;
  touch(
    delivery: Delivery,
    lockedAt: number,
  ): Promise<Result<void, QueueFailure>>;
  release(delivery: Delivery): Promise<Result<void, QueueFailure>>;
}
export type AdapterInput = {
  readonly types: readonly { name: string; version: number }[];
  readonly concurrency: number;
  readonly store: ProcessingStore;
  readonly execute: (
    delivery: Delivery,
    signal: OperationOptions['signal'],
  ) => Promise<void>;
  readonly onError: (failure: QueueFailure) => void;
};
export interface QueueAdapter {
  start(input: AdapterInput): Promise<Result<void, QueueFailure>>;
  stop(options: OperationOptions): Promise<Result<void, QueueFailure>>;
}
