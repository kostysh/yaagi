import type { Result } from '@polyphony/core-types';

export type VersionEntry = {
  readonly name: string;
  readonly version: number;
};

export type BindingEntry = {
  readonly name: string;
  readonly revision: string;
};

export type OperatorBinding = {
  readonly kind: 'linux-uid';
  readonly uid: number;
};

export type BootManifest = {
  readonly schemaVersion: 1;
  readonly codeRevision: string;
  readonly contractVersions: readonly VersionEntry[];
  readonly schemaVersions: readonly VersionEntry[];
  readonly modelBindings: readonly BindingEntry[];
  readonly skillBindings: readonly BindingEntry[];
  readonly configRevision: string;
  readonly constitutionRevision: string;
};

export type BootSchema = {
  readonly schemaVersion: 1;
  readonly versions: readonly VersionEntry[];
};

export type ConstitutionPolicy = {
  readonly schemaVersion: 1;
  readonly revision: string;
  readonly operatorBindings: readonly OperatorBinding[];
  readonly manifest: BootManifest;
};

export type ConstitutionFailure = {
  readonly code: 'denied';
  readonly reason:
    | 'invalid_policy'
    | 'invalid_manifest'
    | 'invalid_schema'
    | 'manifest_mismatch'
    | 'schema_mismatch';
};

export type BootAdmission = {
  readonly policyRevision: string;
  readonly operatorBinding: OperatorBinding;
};

export interface ConstitutionPort {
  readonly checkBoot: (
    manifest: unknown,
    schema: unknown,
  ) => Result<BootAdmission, ConstitutionFailure>;
}
