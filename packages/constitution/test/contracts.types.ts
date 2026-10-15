import type { Result } from '@polyphony/core-types';
import type {
  BootAdmission,
  BootManifest,
  ConstitutionFailure,
  ConstitutionPort,
} from '@polyphony/constitution/contracts';

export function consumer(port: ConstitutionPort, manifest: BootManifest): void {
  const result: Result<BootAdmission, ConstitutionFailure> = port.checkBoot(
    manifest,
    { schemaVersion: 1, versions: [] },
  );
  // @ts-expect-error The port cannot be replaced through its public contract.
  port.checkBoot = () => result;
  // @ts-expect-error Manifest entries are readonly.
  manifest.contractVersions.push({ name: 'extra', version: 1 });
  if (result.ok) {
    const revision: string = result.value.policyRevision;
    const uid: number = result.value.operatorBinding.uid;
    void revision;
    void uid;
    // @ts-expect-error Success does not expose error.
    void result.error;
    // @ts-expect-error Admission cannot mutate policy revision.
    result.value.policyRevision = 'changed';
    // @ts-expect-error Binding is immutable at every exposed level.
    result.value.operatorBinding.uid = 2000;
  } else {
    const reason: ConstitutionFailure['reason'] = result.error.reason;
    void reason;
    // @ts-expect-error Failure does not expose a success value.
    void result.value;
    const invalid: ConstitutionFailure = {
      // @ts-expect-error Constitution failures never grant authority.
      code: 'allowed',
      reason: 'invalid_policy',
    };
    void invalid;
  }
}
