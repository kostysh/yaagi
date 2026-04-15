import {
  PERIMETER_ACTION_CLASS,
  PERIMETER_AUTHORITY_OWNER,
  PERIMETER_INGRESS_OWNER,
  safetyKernelSchema,
  type SafetyKernel,
} from '@yaagi/contracts/perimeter';

export const F0018_SAFETY_KERNEL_VERSION = '2026-04-15.f0018.external-fail-closed';

export const F0018_SAFETY_KERNEL: SafetyKernel = safetyKernelSchema.parse({
  version: F0018_SAFETY_KERNEL_VERSION,
  forbiddenActions: {
    explicitUnavailableActionClasses: [PERIMETER_ACTION_CLASS.DISABLE_EXTERNAL_NETWORK],
  },
  networkEgress: {
    disableExternalNetworkMode: 'explicit_unavailable',
    publicRouteCreation: 'deny',
  },
  promotionChangeGates: {
    actionPolicies: {
      freeze_development: {
        allowedIngressOwners: [
          PERIMETER_INGRESS_OWNER.F_0013,
          PERIMETER_INGRESS_OWNER.PLATFORM_RUNTIME,
        ],
        allowedAuthorityOwners: [PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS],
      },
      code_or_promotion_change: {
        allowedIngressOwners: [PERIMETER_INGRESS_OWNER.F_0016, PERIMETER_INGRESS_OWNER.F_0017],
        allowedAuthorityOwners: [
          PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS,
          PERIMETER_AUTHORITY_OWNER.GOVERNOR,
          PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE,
        ],
      },
      force_rollback: {
        allowedIngressOwners: [PERIMETER_INGRESS_OWNER.F_0017, PERIMETER_INGRESS_OWNER.CF_025],
        allowedAuthorityOwners: [
          PERIMETER_AUTHORITY_OWNER.GOVERNOR,
          PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE,
        ],
      },
    },
  },
  budgetCeilings: {
    maxEvidenceRefsPerRequest: 100,
    maxPayloadBytes: 16_384,
  },
});
