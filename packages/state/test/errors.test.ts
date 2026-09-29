import assert from 'node:assert/strict';
import test from 'node:test';
import type { StorageCode } from '@polyphony/state/contracts';
import { fatal, safeFailure } from '../src/adapters/sqlite/errors.js';
import { coreFailure, StorageError } from '../src/internal/errors.js';

// Pure mapper unit checks complement, not replace, real public fault fixtures.
test('SQLite primary and extended error mapping strips vendor details', () => {
  const cases: readonly (readonly [number, StorageCode])[] = [
    [1, 'operation_failed'],
    [5, 'busy'],
    [6, 'busy'],
    [8, 'write_failed'],
    [10, 'write_failed'],
    [11, 'corrupt'],
    [13, 'full'],
    [14, 'unavailable'],
    [19, 'operation_failed'],
    [26, 'corrupt'],
    [261, 'busy'],
    [517, 'busy'],
    [262, 'busy'],
    [266, 'write_failed'],
    [2067, 'operation_failed'],
    [999, 'operation_failed'],
  ];
  for (const [errcode, code] of cases)
    assert.deepEqual(
      safeFailure({ errcode, message: 'SECRET SQL', path: '/SECRET/path' }),
      { kind: 'storage', code },
    );
});

test('filesystem and loader errors have bounded safe projections', () => {
  const cases: readonly (readonly [StorageCode, readonly string[]])[] = [
    [
      'unavailable',
      ['ENOENT', 'EACCES', 'EPERM', 'ELOOP', 'ENOTDIR', 'EISDIR'],
    ],
    ['full', ['ENOSPC']],
    ['write_failed', ['EROFS', 'EIO']],
    [
      'incompatible',
      [
        'EEXIST',
        'ERR_DLOPEN_FAILED',
        'ERR_MODULE_NOT_FOUND',
        'MODULE_NOT_FOUND',
      ],
    ],
    [
      'operation_failed',
      [
        'ERR_OUT_OF_RANGE',
        'ERR_INVALID_ARG_VALUE',
        'ERR_INVALID_ARG_TYPE',
        'unknown',
      ],
    ],
  ];
  for (const [code, inputs] of cases)
    for (const input of inputs)
      assert.deepEqual(safeFailure({ code: input, message: 'SECRET' }), {
        kind: 'storage',
        code,
      });
});

test('unknown errors cannot spoof core failures or leak payload', () => {
  for (const input of [
    undefined,
    null,
    0,
    'SECRET',
    new Error('SECRET'),
    {},
    { code: 'busy' },
    { errcode: '5' },
  ]) {
    assert.deepEqual(safeFailure(input), {
      kind: 'storage',
      code: 'operation_failed',
    });
    assert.deepEqual(coreFailure(input), {
      kind: 'storage',
      code: 'operation_failed',
    });
  }
  assert.deepEqual(coreFailure({ errcode: 13 }), {
    kind: 'storage',
    code: 'operation_failed',
  });
  for (const code of ['cancelled', 'deadline', 'scope_ended'] as const) {
    assert.deepEqual(safeFailure(new StorageError(code)), {
      kind: 'storage',
      code,
    });
    assert.deepEqual(coreFailure(new StorageError(code)), {
      kind: 'storage',
      code,
    });
  }
});

test('only unusable-storage failures close the SQLite adapter', () => {
  for (const code of ['corrupt', 'unavailable', 'write_failed'] as const)
    assert.equal(fatal(code), true);
  for (const code of [
    'busy',
    'closed',
    'incompatible',
    'full',
    'cancelled',
    'deadline',
    'scope_ended',
    'operation_failed',
    'callback_failed',
  ] as const)
    assert.equal(fatal(code), false);
});
