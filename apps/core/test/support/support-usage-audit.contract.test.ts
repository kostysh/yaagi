import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
      ['F-0029', false, false],
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

void test('AC-F0028-13 wires operator-auth evidence validation through the F-0024 store seam', () => {
  const source = readFileSync(
    new URL('../../src/runtime/runtime-lifecycle.ts', import.meta.url),
    'utf8',
  );
  const supportStart = source.indexOf(
    'const supportEvidence = createDbBackedSupportEvidenceService',
  );
  const supportEnd = source.indexOf('const policyGovernance', supportStart);
  assert.notEqual(supportStart, -1);
  assert.notEqual(supportEnd, -1);

  const supportWiring = source.slice(supportStart, supportEnd);
  assert.match(supportWiring, /createOperatorAuthStore\(client\)/);
  assert.match(supportWiring, /\.hasAllowedAuthEvidence\(evidenceRef\)/);
  assert.doesNotMatch(supportWiring, /operator_auth_audit_events/);
});
