import type { StorageCode, StorageFailure } from '../../contracts.js';
import { StorageError } from '../../internal/errors.js';

export function safeFailure(error: unknown): StorageFailure {
  let code: StorageCode = 'operation_failed';
  if (error instanceof StorageError) code = error.code;
  else if (error !== null && typeof error === 'object') {
    if ('errcode' in error && typeof error.errcode === 'number') {
      const primary = error.errcode & 255;
      const codes: Readonly<Record<number, StorageCode>> = {
        1: 'operation_failed',
        5: 'busy',
        6: 'busy',
        8: 'write_failed',
        10: 'write_failed',
        11: 'corrupt',
        13: 'full',
        14: 'unavailable',
        19: 'operation_failed',
        26: 'corrupt',
      };
      code = codes[primary] ?? 'operation_failed';
    } else if ('code' in error && typeof error.code === 'string') {
      const codes: Readonly<Record<string, StorageCode>> = {
        ENOENT: 'unavailable',
        EACCES: 'unavailable',
        EPERM: 'unavailable',
        ELOOP: 'unavailable',
        ENOTDIR: 'unavailable',
        EISDIR: 'unavailable',
        ENOSPC: 'full',
        EROFS: 'write_failed',
        EIO: 'write_failed',
        EEXIST: 'incompatible',
        ERR_OUT_OF_RANGE: 'operation_failed',
        ERR_INVALID_ARG_VALUE: 'operation_failed',
        ERR_INVALID_ARG_TYPE: 'operation_failed',
        ERR_DLOPEN_FAILED: 'incompatible',
        ERR_MODULE_NOT_FOUND: 'incompatible',
        MODULE_NOT_FOUND: 'incompatible',
      };
      code = codes[error.code] ?? code;
    }
  }
  return { kind: 'storage', code };
}

export function fatal(code: StorageCode): boolean {
  return (
    code === 'corrupt' || code === 'unavailable' || code === 'write_failed'
  );
}
