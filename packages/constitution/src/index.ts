import type { Result } from '@polyphony/core-types';
import { z } from 'zod';
import type {
  BindingEntry,
  BootManifest,
  ConstitutionFailure,
  ConstitutionPolicy,
  ConstitutionPort,
  VersionEntry,
} from './contracts.js';

const text = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const version = z.strictObject({ name: text, version: integer });
const binding = z.strictObject({ name: text, revision: text });
const uniqueNames = (entries: readonly { readonly name: string }[]) =>
  new Set(entries.map((entry) => entry.name)).size === entries.length;
const versions = z.array(version).refine(uniqueNames);
const bindings = z.array(binding).refine(uniqueNames);
const operator = z.strictObject({ kind: z.literal('linux-uid'), uid: integer });
const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  codeRevision: text,
  contractVersions: versions,
  schemaVersions: versions,
  modelBindings: bindings,
  skillBindings: bindings,
  configRevision: text,
  constitutionRevision: text,
});
const bootSchema = z.strictObject({
  schemaVersion: z.literal(1),
  versions,
});
const policySchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    revision: text,
    operatorBindings: z.array(operator).length(1),
    manifest: manifestSchema,
  })
  .refine((policy) => policy.revision === policy.manifest.constitutionRevision);

// Only validated, acyclic DTOs reach this function.
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function denied(
  reason: ConstitutionFailure['reason'],
): Result<never, ConstitutionFailure> {
  const error: ConstitutionFailure = Object.freeze({ code: 'denied', reason });
  return Object.freeze({ ok: false, error });
}

function sameVersions(
  left: readonly VersionEntry[],
  right: readonly VersionEntry[],
): boolean {
  const expected = new Map(right.map((entry) => [entry.name, entry.version]));
  return (
    left.length === right.length &&
    left.every((entry) => expected.get(entry.name) === entry.version)
  );
}

function sameBindings(
  left: readonly BindingEntry[],
  right: readonly BindingEntry[],
): boolean {
  const expected = new Map(right.map((entry) => [entry.name, entry.revision]));
  return (
    left.length === right.length &&
    left.every((entry) => expected.get(entry.name) === entry.revision)
  );
}

function sameManifest(actual: BootManifest, expected: BootManifest): boolean {
  return (
    actual.codeRevision === expected.codeRevision &&
    actual.configRevision === expected.configRevision &&
    actual.constitutionRevision === expected.constitutionRevision &&
    sameVersions(actual.contractVersions, expected.contractVersions) &&
    sameVersions(actual.schemaVersions, expected.schemaVersions) &&
    sameBindings(actual.modelBindings, expected.modelBindings) &&
    sameBindings(actual.skillBindings, expected.skillBindings)
  );
}

export function createConstitution(
  input: unknown,
): Result<ConstitutionPort, ConstitutionFailure> {
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return denied('invalid_policy');

  // Zod produces a separate DTO tree; freeze that snapshot, not caller data.
  const policy: ConstitutionPolicy = freeze(parsed.data);
  const port: ConstitutionPort = Object.freeze({
    checkBoot(manifest: unknown, schema: unknown) {
      const actual = manifestSchema.safeParse(manifest);
      if (!actual.success) return denied('invalid_manifest');
      const registered = bootSchema.safeParse(schema);
      if (!registered.success) return denied('invalid_schema');
      if (!sameManifest(actual.data, policy.manifest))
        return denied('manifest_mismatch');
      if (!sameVersions(registered.data.versions, actual.data.schemaVersions))
        return denied('schema_mismatch');
      return freeze({
        ok: true as const,
        value: {
          policyRevision: policy.revision,
          operatorBinding: policy.operatorBindings[0],
        },
      });
    },
  });
  return Object.freeze({ ok: true, value: port });
}
