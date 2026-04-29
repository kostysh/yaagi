import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_CANONICAL_SURFACE_AUDIT,
  assertSupportCanonicalSurfaceAudit,
} from '../../src/support/support-canonical-refs.ts';

void test('AC-F0028-14 documents support consumption of canonical upstream surfaces only', () => {
  assert.doesNotThrow(() => assertSupportCanonicalSurfaceAudit(SUPPORT_CANONICAL_SURFACE_AUDIT));
  assert.deepEqual(
    SUPPORT_CANONICAL_SURFACE_AUDIT.map((row) => [
      row.owner,
      row.rawForeignRead,
      row.rawForeignWrite,
    ]),
    [
      ['F-0013', false, false],
      ['F-0023', false, false],
      ['F-0024', false, false],
      ['F-0026', false, false],
    ],
  );
});

void test('AC-F0028-13 fails the usage audit when a support consumer declares raw foreign access', () => {
  assert.throws(() =>
    assertSupportCanonicalSurfaceAudit([
      ...SUPPORT_CANONICAL_SURFACE_AUDIT,
      {
        owner: 'F-0023',
        surface: 'polyphony_runtime.report_runs',
        accessMode: 'read_contract',
        rawForeignRead: true,
        rawForeignWrite: false,
      },
    ]),
  );
});
