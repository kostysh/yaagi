import assert from 'node:assert/strict';
import { createConstitution } from '@polyphony/constitution';
import type {
  BootManifest,
  BootSchema,
  ConstitutionPolicy,
} from '@polyphony/constitution/contracts';

// Host policy and actual root inputs are independently supplied.
const policy: ConstitutionPolicy = {
  schemaVersion: 1,
  revision: 'policy-1',
  operatorBindings: [{ kind: 'linux-uid', uid: 1000 }],
  manifest: {
    schemaVersion: 1,
    codeRevision: 'body-1',
    contractVersions: [{ name: 'constitution', version: 1 }],
    schemaVersions: [],
    modelBindings: [],
    skillBindings: [],
    configRevision: 'config-1',
    constitutionRevision: 'policy-1',
  },
};
const actual: BootManifest = {
  schemaVersion: 1,
  codeRevision: 'body-1',
  contractVersions: [{ name: 'constitution', version: 1 }],
  schemaVersions: [],
  modelBindings: [],
  skillBindings: [],
  configRevision: 'config-1',
  constitutionRevision: 'policy-1',
};
const schemas: BootSchema = { schemaVersion: 1, versions: [] };
const created = createConstitution(policy);
assert.ok(created.ok);
const port = created.value;

assert.ok(port.checkBoot(actual, schemas).ok);
console.log('boot: allowed');

const mismatch = port.checkBoot(
  { ...actual, configRevision: 'incorrect-config' },
  schemas,
);
assert.deepEqual(mismatch, {
  ok: false,
  error: { code: 'denied', reason: 'manifest_mismatch' },
});
console.log('boot: denied/manifest_mismatch');

assert.ok(port.checkBoot(actual, schemas).ok);
console.log('boot after configuration correction: allowed');

assert.deepEqual(createConstitution(null), {
  ok: false,
  error: { code: 'denied', reason: 'invalid_policy' },
});
