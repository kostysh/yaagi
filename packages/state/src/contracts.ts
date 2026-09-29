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
  | 'sql_failed'
  | 'callback_failed';
export type StorageFailure = {
  readonly kind: 'storage';
  readonly code: StorageCode;
};
export type OwnerFailure<E> = { readonly kind: 'owner'; readonly error: E };
export type OperationOptions = {
  readonly signal: { readonly aborted: boolean };
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
  close(): Promise<Result<void, StorageFailure>>;
}
