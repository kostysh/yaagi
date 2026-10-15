import type {
  BootManifest,
  BootSchema,
  ConstitutionPolicy,
} from '@polyphony/constitution/contracts';

// Expected policy and actual root inputs are independent fixtures.
export const policyFixture = () =>
  ({
    schemaVersion: 1,
    revision: 'policy-1',
    operatorBindings: [{ kind: 'linux-uid', uid: 1000 }],
    manifest: {
      schemaVersion: 1,
      codeRevision: 'body-1',
      contractVersions: [
        { name: 'constitution', version: 1 },
        { name: 'memory', version: 1 },
      ],
      schemaVersions: [
        { name: 'memory', version: 1 },
        { name: 'timeline', version: 1 },
      ],
      modelBindings: [
        { name: 'reasoning', revision: 'configured-organ-1' },
        { name: 'evaluation', revision: 'configured-organ-2' },
      ],
      skillBindings: [
        { name: 'read', revision: 'skill-version-hash-1' },
        { name: 'summarize', revision: 'skill-version-hash-2' },
      ],
      configRevision: 'config-1',
      constitutionRevision: 'policy-1',
    },
  }) satisfies ConstitutionPolicy;

export const actualManifest = () =>
  ({
    schemaVersion: 1,
    codeRevision: 'body-1',
    contractVersions: [
      { name: 'memory', version: 1 },
      { name: 'constitution', version: 1 },
    ],
    schemaVersions: [
      { name: 'timeline', version: 1 },
      { name: 'memory', version: 1 },
    ],
    modelBindings: [
      { name: 'evaluation', revision: 'configured-organ-2' },
      { name: 'reasoning', revision: 'configured-organ-1' },
    ],
    skillBindings: [
      { name: 'summarize', revision: 'skill-version-hash-2' },
      { name: 'read', revision: 'skill-version-hash-1' },
    ],
    configRevision: 'config-1',
    constitutionRevision: 'policy-1',
  }) satisfies BootManifest;

export const registeredSchemas = () =>
  ({
    schemaVersion: 1,
    versions: [
      { name: 'memory', version: 1 },
      { name: 'timeline', version: 1 },
    ],
  }) satisfies BootSchema;
