import {
  PERIMETER_ACTION_CLASS,
  PERIMETER_INGRESS_OWNER,
  safetyKernelSchema,
  type SafetyKernel,
} from '@yaagi/contracts/perimeter';

export const F0018_SAFETY_KERNEL_VERSION = '2026-04-14.f0018.sl-f0018-01';

export const F0018_SAFETY_KERNEL: SafetyKernel = safetyKernelSchema.parse({
  version: F0018_SAFETY_KERNEL_VERSION,
  forbiddenActions: {
    explicitUnavailableActionClasses: [
      PERIMETER_ACTION_CLASS.FORCE_ROLLBACK,
      PERIMETER_ACTION_CLASS.DISABLE_EXTERNAL_NETWORK,
    ],
  },
  networkEgress: {
    disableExternalNetworkMode: 'explicit_unavailable',
    publicRouteCreation: 'deny',
  },
  promotionChangeGates: {
    actionPolicies: {
      freeze_development: {
        allowedIngressOwners: [PERIMETER_INGRESS_OWNER.F_0013],
        allowedAuthorityOwners: ['governor', 'human_override'],
      },
      code_or_promotion_change: {
        allowedIngressOwners: [PERIMETER_INGRESS_OWNER.F_0016, PERIMETER_INGRESS_OWNER.F_0017],
        allowedAuthorityOwners: ['governor', 'human_override'],
      },
    },
  },
  budgetCeilings: {
    maxEvidenceRefsPerRequest: 100,
    maxPayloadBytes: 16_384,
  },
});
