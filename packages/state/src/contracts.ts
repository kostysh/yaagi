import type { Result } from '@polyphony/core-types';

export type StorageCode =
  | 'busy'
  | 'closed'
  | 'unavailable'
  | 'corrupt'
  | 'incompatible'
  | 'full'
  | 'write_failed'
  | 'cancelled'
  | 'deadline'
  | 'scope_ended'
  | 'operation_failed'
  | 'callback_failed';
export type StorageFailure = {
  readonly kind: 'storage';
  readonly code: StorageCode;
};
export type OwnerFailure<E> = { readonly kind: 'owner'; readonly error: E };
export type OperationOptions = {
  readonly signal: {
    readonly aborted: boolean;
    addEventListener(
      type: 'abort',
      listener: () => void,
      options?: { once?: boolean },
    ): void;
    removeEventListener(type: 'abort', listener: () => void): void;
  };
  readonly timeoutMs: number;
};
export type SchemaStatus = {
  readonly applied: number;
  readonly pending: number;
};
export interface StoragePort<S> {
  readSnapshot<T>(
    read: (scope: S) => Promise<T>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure>>;
  transact<T, E>(
    write: (scope: S) => Promise<Result<T, E>>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure | OwnerFailure<E>>>;
  checkSchema(
    options: OperationOptions,
  ): Promise<Result<SchemaStatus, StorageFailure>>;
  migrate(options: OperationOptions): Promise<Result<void, StorageFailure>>;
  close(): Promise<Result<void, StorageFailure>>;
}

export interface StorageSession<S> {
  readonly scope: S;
  readonly failure: StorageFailure | undefined;
  finish(outcome: 'commit' | 'rollback'): Promise<Result<void, StorageFailure>>;
}
export interface StorageAdapter<S> {
  begin(
    mode: 'snapshot' | 'transaction',
    options: OperationOptions,
  ): Promise<Result<StorageSession<S>, StorageFailure>>;
  checkSchema(
    options: OperationOptions,
  ): Promise<Result<SchemaStatus, StorageFailure>>;
  migrate(options: OperationOptions): Promise<Result<void, StorageFailure>>;
  close(): Promise<Result<void, StorageFailure>>;
}
