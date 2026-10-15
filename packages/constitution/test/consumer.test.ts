import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Result } from '@polyphony/core-types';
import { createConstitution } from '@polyphony/constitution';
import type {
  BootAdmission,
  ConstitutionFailure,
  ConstitutionPort,
} from '@polyphony/constitution/contracts';
import {
  actualManifest,
  policyFixture,
  registeredSchemas,
} from './fixtures.js';

const allowed: Result<BootAdmission, ConstitutionFailure> = Object.freeze({
  ok: true,
  value: Object.freeze({
    policyRevision: 'policy-1',
    operatorBinding: Object.freeze({ kind: 'linux-uid', uid: 1000 }),
  }),
});
const rejected = (
  reason: ConstitutionFailure['reason'],
): Result<BootAdmission, ConstitutionFailure> =>
  Object.freeze({
    ok: false,
    error: Object.freeze({ code: 'denied', reason }),
  });

const scenarios = [
  {
    manifest: actualManifest(),
    schema: registeredSchemas(),
    expected: allowed,
  },
  {
    manifest: null,
    schema: registeredSchemas(),
    expected: rejected('invalid_manifest'),
  },
  {
    manifest: actualManifest(),
    schema: null,
    expected: rejected('invalid_schema'),
  },
  {
    manifest: { ...actualManifest(), codeRevision: 'different' },
    schema: registeredSchemas(),
    expected: rejected('manifest_mismatch'),
  },
  {
    manifest: actualManifest(),
    schema: { schemaVersion: 1, versions: [] },
    expected: rejected('schema_mismatch'),
  },
];

// A finite, test-only fixture double; never exported or used by the package.
// Unknown scenarios fail loudly instead of returning a fabricated admission.
const fixtureDouble: ConstitutionPort = Object.freeze({
  checkBoot(manifest: unknown, schema: unknown) {
    const scenario = scenarios.find(
      (entry) =>
        JSON.stringify([entry.manifest, entry.schema]) ===
        JSON.stringify([manifest, schema]),
    );
    assert.ok(
      scenario,
      'fixture double only supports the declared contract cases',
    );
    return scenario.expected;
  },
});

// Unchanged consumer, depending only on the public port and Result discriminant.
function bootConsumer(
  port: ConstitutionPort,
  manifest: unknown,
  schema: unknown,
): string {
  const result = port.checkBoot(manifest, schema);
  return result.ok
    ? `ready:${result.value.policyRevision}:${result.value.operatorBinding.uid}`
    : `denied:${result.error.reason}`;
}

const production = createConstitution(policyFixture());
assert.ok(production.ok);
for (const [name, port] of [
  ['production', production.value],
  ['fixture double', fixtureDouble],
] as const) {
  test(`M1: unchanged consumer and shared boot contract scenarios with ${name}`, () => {
    for (const scenario of scenarios) {
      assert.deepEqual(
        port.checkBoot(scenario.manifest, scenario.schema),
        scenario.expected,
      );
      const expected = scenario.expected.ok
        ? 'ready:policy-1:1000'
        : `denied:${scenario.expected.error.reason}`;
      assert.equal(
        bootConsumer(port, scenario.manifest, scenario.schema),
        expected,
      );
    }
    assert.equal(
      bootConsumer(port, actualManifest(), registeredSchemas()),
      'ready:policy-1:1000',
    );
  });
}
