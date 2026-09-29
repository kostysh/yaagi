import type { StorageCode, StorageFailure } from '../contracts.js';

export class StorageError extends Error {
  readonly code: StorageCode;
  constructor(code: StorageCode) {
    super(code);
    this.code = code;
  }
}
export function failure(code: StorageCode): StorageFailure {
  return { kind: 'storage', code };
}
export function coreFailure(error: unknown): StorageFailure {
  return failure(
    error instanceof StorageError ? error.code : 'operation_failed',
  );
}
