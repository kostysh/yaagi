import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConstitution } from '@polyphony/constitution';
import type {
  ConstitutionFailure,
  ConstitutionPort,
} from '@polyphony/constitution/contracts';
import {
  actualManifest,
  policyFixture,
  registeredSchemas,
} from './fixtures.js';

function portFor(input: unknown = policyFixture()): ConstitutionPort {
  const created = createConstitution(input);
  assert.ok(created.ok);
  return created.value;
}

const failure = (reason: ConstitutionFailure['reason']) => ({
  ok: false,
  error: { code: 'denied', reason },
});

test('C1-R8: independently supplied matching inputs admit boot synchronously', () => {
  const port = portFor();
  const result = port.checkBoot(actualManifest(), registeredSchemas());
  assert.deepEqual(result, {
    ok: true,
    value: {
      policyRevision: 'policy-1',
      operatorBinding: { kind: 'linux-uid', uid: 1000 },
    },
  });
  assert.equal(result instanceof Promise, false);
});

test('C1-R1/R3: missing, corrupt and internally inconsistent policy are denied', () => {
  const base = policyFixture();
  for (const input of [
    undefined,
    null,
    false,
    1,
    'policy',
    [],
    {},
    { ...base, schemaVersion: 2 },
    { ...base, revision: '' },
    { ...base, revision: ' policy-1' },
    { ...base, revision: 'other-policy' },
    { ...base, injected: 'extra' },
    { ...base, manifest: { ...base.manifest, extra: true } },
    { ...base, manifest: null },
  ]) {
    assert.deepEqual(createConstitution(input), failure('invalid_policy'));
  }
});

test('C1-R2: exactly one unambiguous operator binding is required', () => {
  for (const operatorBindings of [
    [],
    [
      { kind: 'linux-uid', uid: 1000 },
      { kind: 'linux-uid', uid: 1001 },
    ],
    [
      { kind: 'linux-uid', uid: 1000 },
      { kind: 'linux-uid', uid: 1000 },
    ],
    [{ kind: 'username', uid: 1000 }],
    [{ kind: 'linux-uid', uid: '1000' }],
    [{ kind: 'linux-uid', uid: 1000, operator: true }],
    [{}],
  ]) {
    assert.deepEqual(
      createConstitution({ ...policyFixture(), operatorBindings }),
      failure('invalid_policy'),
    );
  }
});

test('C1-R1/R5: integer and string constraints are checked without coercion', () => {
  const port = portFor();
  for (const uid of [
    -1,
    0.1,
    Number.NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.deepEqual(
      createConstitution({
        ...policyFixture(),
        operatorBindings: [{ kind: 'linux-uid', uid }],
      }),
      failure('invalid_policy'),
    );
  }
  const rootPolicy = policyFixture();
  rootPolicy.operatorBindings[0].uid = 0;
  assert.ok(createConstitution(rootPolicy).ok);
  for (const version of [
    -1,
    0.5,
    Number.NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '1',
  ]) {
    assert.deepEqual(
      port.checkBoot(
        {
          ...actualManifest(),
          contractVersions: [{ name: 'constitution', version }],
        },
        registeredSchemas(),
      ),
      failure('invalid_manifest'),
    );
    assert.deepEqual(
      port.checkBoot(actualManifest(), {
        schemaVersion: 1,
        versions: [{ name: 'memory', version }],
      }),
      failure('invalid_schema'),
    );
  }
  for (const name of ['', ' memory', 'memory ']) {
    assert.deepEqual(
      port.checkBoot(
        { ...actualManifest(), contractVersions: [{ name, version: 1 }] },
        registeredSchemas(),
      ),
      failure('invalid_manifest'),
    );
  }
});

test('C1-R5: all required manifest fields, discriminants and nested shapes are validated', () => {
  const port = portFor();
  for (const field of Object.keys(actualManifest())) {
    const missing = { ...actualManifest() };
    Reflect.deleteProperty(missing, field);
    assert.deepEqual(
      port.checkBoot(missing, registeredSchemas()),
      failure('invalid_manifest'),
    );
  }
  for (const manifest of [
    undefined,
    null,
    'body',
    {},
    { ...actualManifest(), schemaVersion: 2 },
    { ...actualManifest(), codeRevision: '' },
    { ...actualManifest(), configRevision: ' config-1 ' },
    { ...actualManifest(), skillBindings: null },
    {
      ...actualManifest(),
      modelBindings: [{ name: 'reasoning', revision: '' }],
    },
    {
      ...actualManifest(),
      contractVersions: [{ name: 'constitution', version: 1, extra: true }],
    },
    {
      ...actualManifest(),
      modelBindings: [
        { name: 'reasoning', revision: 'configured-organ-1', extra: true },
      ],
    },
    { ...actualManifest(), extra: true },
  ]) {
    assert.deepEqual(
      port.checkBoot(manifest, registeredSchemas()),
      failure('invalid_manifest'),
    );
  }
  for (const schema of [
    undefined,
    null,
    {},
    { versions: [] },
    { schemaVersion: 2, versions: [] },
    { ...registeredSchemas(), extra: true },
  ]) {
    assert.deepEqual(
      port.checkBoot(actualManifest(), schema),
      failure('invalid_schema'),
    );
  }
});

test('C1-R5: duplicate names are invalid, including identical duplicate entries', () => {
  const port = portFor();
  for (const key of [
    'contractVersions',
    'schemaVersions',
    'modelBindings',
    'skillBindings',
  ] as const) {
    const manifest = actualManifest();
    const duplicate = [...manifest[key], manifest[key][0]];
    assert.deepEqual(
      port.checkBoot({ ...manifest, [key]: duplicate }, registeredSchemas()),
      failure('invalid_manifest'),
    );
    assert.deepEqual(
      createConstitution({
        ...policyFixture(),
        manifest: { ...manifest, [key]: duplicate },
      }),
      failure('invalid_policy'),
    );
  }
  const schema = registeredSchemas();
  schema.versions.push({ ...schema.versions[0] });
  assert.deepEqual(
    port.checkBoot(actualManifest(), schema),
    failure('invalid_schema'),
  );
});

test('C1-R6: each actual scalar revision is checked against the unchanged policy', () => {
  const port = portFor();
  for (const key of [
    'codeRevision',
    'configRevision',
    'constitutionRevision',
  ] as const) {
    assert.deepEqual(
      port.checkBoot(
        { ...actualManifest(), [key]: 'different' },
        registeredSchemas(),
      ),
      failure('manifest_mismatch'),
    );
  }
});

test('C1-R6: contract/schema versions and composition changes deny boot', () => {
  const port = portFor();
  for (const key of ['contractVersions', 'schemaVersions'] as const) {
    const original = actualManifest()[key];
    for (const entries of [
      [{ ...original[0], version: 9 }, original[1]],
      [{ ...original[0], name: 'different-owner' }, original[1]],
      original.slice(1),
      [...original, { name: 'extra-owner', version: 1 }],
    ]) {
      assert.deepEqual(
        port.checkBoot(
          { ...actualManifest(), [key]: entries },
          registeredSchemas(),
        ),
        failure('manifest_mismatch'),
      );
    }
  }
});

test('C1-R6: model/skill binding revisions and composition changes deny boot', () => {
  const port = portFor();
  for (const key of ['modelBindings', 'skillBindings'] as const) {
    const original = actualManifest()[key];
    for (const entries of [
      [{ ...original[0], revision: 'different-binding' }, original[1]],
      [{ ...original[0], name: 'different-role' }, original[1]],
      original.slice(1),
      [...original, { name: 'extra-binding', revision: 'extra' }],
    ]) {
      assert.deepEqual(
        port.checkBoot(
          { ...actualManifest(), [key]: entries },
          registeredSchemas(),
        ),
        failure('manifest_mismatch'),
      );
    }
  }
});

test('C1-R7: matching policy/manifest cannot conceal different registered schemas', () => {
  const port = portFor();
  for (const versions of [
    [],
    [
      { name: 'memory', version: 2 },
      { name: 'timeline', version: 1 },
    ],
    [
      { name: 'different-owner', version: 1 },
      { name: 'timeline', version: 1 },
    ],
    [...registeredSchemas().versions, { name: 'extra', version: 1 }],
  ]) {
    assert.deepEqual(
      port.checkBoot(actualManifest(), { schemaVersion: 1, versions }),
      failure('schema_mismatch'),
    );
  }
});

test('C1-R8: empty model/skill bindings and zero schema version need no fabricated organs', () => {
  const policy = policyFixture();
  policy.manifest.modelBindings = [];
  policy.manifest.skillBindings = [];
  policy.manifest.schemaVersions = [{ name: 'empty-owner', version: 0 }];
  const actual = actualManifest();
  actual.modelBindings = [];
  actual.skillBindings = [];
  actual.schemaVersions = [{ name: 'empty-owner', version: 0 }];
  assert.ok(
    portFor(policy).checkBoot(actual, {
      schemaVersion: 1,
      versions: [{ name: 'empty-owner', version: 0 }],
    }).ok,
  );
});

test('C1-R4/R9: nested caller mutations cannot change the accepted policy snapshot', () => {
  const policy = policyFixture();
  const original = structuredClone(policy);
  const port = portFor(policy);
  assert.deepEqual(policy, original);
  assert.equal(Object.isFrozen(policy), false);
  policy.revision = 'changed';
  policy.operatorBindings[0].uid = 2000;
  policy.manifest.codeRevision = 'changed';
  policy.manifest.contractVersions[0].version = 99;
  policy.manifest.schemaVersions[0].version = 99;
  policy.manifest.modelBindings[0].revision = 'changed';
  policy.manifest.skillBindings[0].revision = 'changed';
  policy.manifest.configRevision = 'changed';
  policy.manifest.constitutionRevision = 'changed';
  assert.deepEqual(port.checkBoot(actualManifest(), registeredSchemas()), {
    ok: true,
    value: {
      policyRevision: 'policy-1',
      operatorBinding: { kind: 'linux-uid', uid: 1000 },
    },
  });
});

test('C1-R9: port, admissions and failures are frozen and retain no mutable input aliases', () => {
  const port = portFor();
  const manifest = actualManifest();
  const schema = registeredSchemas();
  const before = structuredClone({ manifest, schema });
  const result = port.checkBoot(manifest, schema);
  assert.ok(result.ok);
  assert.deepEqual({ manifest, schema }, before);
  for (const [target, key, value] of [
    [port, 'checkBoot', () => failure('invalid_policy')],
    [result, 'ok', false],
    [result.value, 'policyRevision', 'changed'],
    [result.value.operatorBinding, 'uid', 2000],
  ] as const) {
    assert.equal(Object.isFrozen(target), true);
    assert.throws(() => Object.assign(target, { [key]: value }), TypeError);
  }
  manifest.codeRevision = 'later-change';
  schema.versions[0].version = 99;
  assert.ok(port.checkBoot(actualManifest(), registeredSchemas()).ok);
  const rejected = port.checkBoot(null, null);
  assert.ok(!rejected.ok);
  assert.ok(Object.isFrozen(rejected));
  assert.ok(Object.isFrozen(rejected.error));
});

test('error precedence and recovery do not create a latch or authorize later mismatches', () => {
  const port = portFor();
  assert.deepEqual(port.checkBoot(null, null), failure('invalid_manifest'));
  assert.deepEqual(
    port.checkBoot({ ...actualManifest(), codeRevision: 'wrong' }, null),
    failure('invalid_schema'),
  );
  assert.deepEqual(
    port.checkBoot(
      { ...actualManifest(), codeRevision: 'wrong' },
      { schemaVersion: 1, versions: [] },
    ),
    failure('manifest_mismatch'),
  );
  assert.ok(port.checkBoot(actualManifest(), registeredSchemas()).ok);
  assert.deepEqual(
    port.checkBoot(
      { ...actualManifest(), codeRevision: 'wrong' },
      registeredSchemas(),
    ),
    failure('manifest_mismatch'),
  );
  assert.ok(port.checkBoot(actualManifest(), registeredSchemas()).ok);
});

test('C1-R11: failures expose only fixed reason codes, never supplied canary data', () => {
  const secret = 'CANARY-private-key-and-config-path';
  const port = portFor();
  const results = [
    createConstitution({ ...policyFixture(), secret }),
    port.checkBoot({ ...actualManifest(), secret }, registeredSchemas()),
    port.checkBoot(actualManifest(), { ...registeredSchemas(), secret }),
    port.checkBoot(
      { ...actualManifest(), codeRevision: secret },
      registeredSchemas(),
    ),
    port.checkBoot(actualManifest(), {
      schemaVersion: 1,
      versions: [{ name: secret, version: 1 }],
    }),
  ];
  for (const result of results) {
    assert.ok(!result.ok);
    assert.deepEqual(Object.keys(result.error).sort(), ['code', 'reason']);
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});
