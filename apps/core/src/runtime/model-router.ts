import {
  BASELINE_MODEL_PROFILE_ROLE,
  MODEL_PROFILE_ROLE,
  MODEL_PROFILE_STATUS,
  type BaselineModelProfileRole,
  type ModelProfileStatus,
  type RuntimeModelProfileRow,
  type RuntimeModelProfileSeedInput,
  type RuntimeModelProfileStore,
} from '@yaagi/db';
import type {
  SpecialistAdmissionInput,
  SpecialistAdmissionResult,
  SpecialistPolicyService,
} from './specialist-policy.ts';

export const PHASE0_BASELINE_PROFILE_ID = Object.freeze({
  REFLEX: 'reflex.fast@baseline',
  DELIBERATION: 'deliberation.fast@baseline',
  REFLECTION: 'reflection.fast@baseline',
} as const);

export type BaselineTickMode = 'reactive' | 'deliberative' | 'contemplative';

export type ModelHealthSummary = {
  healthy: boolean;
  detail?: string;
};

export type BaselineRoutingInput = {
  tickMode: BaselineTickMode;
  taskKind: string;
  latencyBudget: 'tight' | 'normal' | 'extended';
  riskLevel: 'low' | 'medium' | 'high';
  contextSize: number;
  requiredCapabilities?: string[];
  lastEvalScore?: number | null;
  requestedRole?: string;
  organHealth?: Partial<Record<BaselineModelProfileRole, ModelHealthSummary>>;
};

export type BaselineModelProfileDiagnostic = {
  modelProfileId: string;
  role: BaselineModelProfileRole;
  serviceId: string;
  endpoint: string;
  artifactUri: string | null;
  baseModel: string;
  adapterOf: string | null;
  artifactDescriptorPath: string | null;
  runtimeArtifactRoot: string | null;
  bootCritical: boolean;
  optionalUntilPromoted: boolean;
  readiness: 'ready' | 'warming' | 'degraded' | 'unavailable';
  readinessBasis:
    | 'probe_passed'
    | 'descriptor_invalid'
    | 'artifact_missing'
    | 'transport_failed'
    | 'probe_failed'
    | null;
  capabilities: string[];
  status: ModelProfileStatus;
  healthSummary: ModelHealthSummary;
  eligibility: 'eligible' | 'profile_unavailable' | 'profile_unhealthy';
};

export type BaselineRoutingSelection =
  | {
      accepted: true;
      modelProfileId: string;
      role: BaselineModelProfileRole;
      endpoint: string;
      adapterOf: string | null;
      selectionReason: {
        tickMode: BaselineTickMode;
        taskKind: string;
        latencyBudget: BaselineRoutingInput['latencyBudget'];
        riskLevel: BaselineRoutingInput['riskLevel'];
        contextSize: number;
        requiredCapabilities: string[];
        lastEvalScore: number | null;
        health: ModelHealthSummary;
      };
    }
  | {
      accepted: false;
      reason: 'unsupported_role' | 'profile_unavailable' | 'profile_unhealthy';
      detail: string;
    };

export type SpecialistRoutingAdmissionSelection =
  | {
      accepted: true;
      specialistId: string;
      modelProfileId: string;
      admissionDecisionId: string;
      stage: NonNullable<
        Extract<SpecialistAdmissionResult, { accepted: true }>['decision']['stage']
      >;
      selectionReason: {
        taskSignature: string;
        policyId: string;
        admissionDecisionId: string;
      };
    }
  | {
      accepted: false;
      reason:
        | 'specialist_policy_unavailable'
        | 'specialist_admission_refused'
        | 'specialist_admission_replayed';
      detail: string;
      specialistId: string;
      remapped: false;
      fallbackTargetProfileId: string | null;
      admissionDecisionId: string | null;
    };

export type Phase0ModelRouter = {
  ensureBaselineProfiles(): Promise<BaselineModelProfileDiagnostic[]>;
  selectProfile(input: BaselineRoutingInput): Promise<BaselineRoutingSelection>;
  admitSpecialistSelection(
    input: SpecialistAdmissionInput,
  ): Promise<SpecialistRoutingAdmissionSelection>;
  getBaselineDiagnostics(
    input?: Pick<BaselineRoutingInput, 'organHealth'>,
  ): Promise<BaselineModelProfileDiagnostic[]>;
};

type Phase0ModelRouterOptions = {
  fastModelBaseUrl: string;
  store: RuntimeModelProfileStore;
  baselineProfiles?: RuntimeModelProfileSeedInput[];
  resolveBaselineHealth?: () => Promise<
    Partial<Record<BaselineModelProfileRole, ModelHealthSummary>>
  >;
  specialistPolicy?: Pick<SpecialistPolicyService, 'admitSpecialist'>;
};

const BASELINE_ROLE_BY_TICK_MODE: Record<BaselineTickMode, BaselineModelProfileRole> = {
  reactive: BASELINE_MODEL_PROFILE_ROLE.REFLEX,
  deliberative: BASELINE_MODEL_PROFILE_ROLE.DELIBERATION,
  contemplative: BASELINE_MODEL_PROFILE_ROLE.REFLECTION,
};

const baselineProfileSorter = (
  left: RuntimeModelProfileRow,
  right: RuntimeModelProfileRow,
): number => {
  const leftStatusRank =
    left.status === MODEL_PROFILE_STATUS.ACTIVE
      ? 0
      : left.status === MODEL_PROFILE_STATUS.DEGRADED
        ? 1
        : 2;
  const rightStatusRank =
    right.status === MODEL_PROFILE_STATUS.ACTIVE
      ? 0
      : right.status === MODEL_PROFILE_STATUS.DEGRADED
        ? 1
        : 2;

  if (leftStatusRank !== rightStatusRank) {
    return leftStatusRank - rightStatusRank;
  }

  if (left.adapterOf === null && right.adapterOf !== null) {
    return -1;
  }
  if (left.adapterOf !== null && right.adapterOf === null) {
    return 1;
  }

  return left.modelProfileId.localeCompare(right.modelProfileId);
};

const toHealthSummary = (
  profile: RuntimeModelProfileRow,
  override?: ModelHealthSummary,
): ModelHealthSummary => {
  if (override) {
    return override;
  }

  const stored = profile.healthJson;
  const healthy = typeof stored['healthy'] === 'boolean' ? stored['healthy'] : true;
  const detail = typeof stored['detail'] === 'string' ? stored['detail'] : undefined;

  return detail ? { healthy, detail } : { healthy };
};

const readBoolean = (value: Record<string, unknown>, key: string, fallback: boolean): boolean =>
  typeof value[key] === 'boolean' ? value[key] : fallback;

const readStringOrNull = (value: Record<string, unknown>, key: string): string | null =>
  typeof value[key] === 'string' ? value[key] : null;

const createBaselineProfiles = (fastModelBaseUrl: string): RuntimeModelProfileSeedInput[] => [
  {
    modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
    role: MODEL_PROFILE_ROLE.REFLEX,
    serviceId: 'vllm-fast',
    endpoint: fastModelBaseUrl,
    baseModel: 'model-fast',
    capabilities: ['reactive', 'low-latency', 'text-generation'],
    costJson: {
      class: 'phase0-fast',
    },
    healthJson: {
      healthy: true,
      detail: 'phase-0 baseline reflex profile',
    },
    status: MODEL_PROFILE_STATUS.ACTIVE,
  },
  {
    modelProfileId: PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
    role: MODEL_PROFILE_ROLE.DELIBERATION,
    serviceId: 'vllm-fast',
    endpoint: fastModelBaseUrl,
    baseModel: 'model-fast',
    capabilities: ['deliberation', 'structured-output', 'longer-context'],
    costJson: {
      class: 'phase0-fast',
    },
    healthJson: {
      healthy: true,
      detail: 'phase-0 baseline deliberation profile',
    },
    status: MODEL_PROFILE_STATUS.ACTIVE,
  },
  {
    modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLECTION,
    role: MODEL_PROFILE_ROLE.REFLECTION,
    serviceId: 'vllm-fast',
    endpoint: fastModelBaseUrl,
    baseModel: 'model-fast',
    adapterOf: PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
    capabilities: ['reflection', 'retrospective-analysis'],
    costJson: {
      class: 'phase0-fast',
    },
    healthJson: {
      healthy: true,
      detail: 'phase-0 reflection adapter profile',
    },
    status: MODEL_PROFILE_STATUS.ACTIVE,
  },
];

const toBaselineDiagnostic = (
  profile: RuntimeModelProfileRow,
  healthSummary: ModelHealthSummary,
  requiredCapabilities: string[] = [],
): BaselineModelProfileDiagnostic => {
  const missingCapability = requiredCapabilities.find(
    (capability) => !profile.capabilitiesJson.includes(capability),
  );

  const eligibility =
    profile.status === MODEL_PROFILE_STATUS.DISABLED
      ? 'profile_unavailable'
      : missingCapability
        ? 'profile_unavailable'
        : healthSummary.healthy
          ? 'eligible'
          : 'profile_unhealthy';

  return {
    modelProfileId: profile.modelProfileId,
    role: profile.role as BaselineModelProfileRole,
    serviceId: profile.serviceId,
    endpoint: profile.endpoint,
    artifactUri: profile.artifactUri,
    baseModel: profile.baseModel,
    adapterOf: profile.adapterOf,
    artifactDescriptorPath: readStringOrNull(profile.healthJson, 'artifactDescriptorPath'),
    runtimeArtifactRoot: readStringOrNull(profile.healthJson, 'runtimeArtifactRoot'),
    bootCritical: readBoolean(profile.healthJson, 'bootCritical', true),
    optionalUntilPromoted: readBoolean(profile.healthJson, 'optionalUntilPromoted', false),
    readiness:
      profile.healthJson['readiness'] === 'ready' ||
      profile.healthJson['readiness'] === 'warming' ||
      profile.healthJson['readiness'] === 'degraded' ||
      profile.healthJson['readiness'] === 'unavailable'
        ? profile.healthJson['readiness']
        : 'warming',
    readinessBasis:
      profile.healthJson['readinessBasis'] === 'probe_passed' ||
      profile.healthJson['readinessBasis'] === 'descriptor_invalid' ||
      profile.healthJson['readinessBasis'] === 'artifact_missing' ||
      profile.healthJson['readinessBasis'] === 'transport_failed' ||
      profile.healthJson['readinessBasis'] === 'probe_failed'
        ? (profile.healthJson['readinessBasis'] as BaselineModelProfileDiagnostic['readinessBasis'])
        : null,
    capabilities: profile.capabilitiesJson,
    status: profile.status,
    healthSummary,
    eligibility,
  };
};

const toUnsupportedRole = (requestedRole: string): BaselineRoutingSelection => ({
  accepted: false,
  reason: 'unsupported_role',
  detail: `requested baseline role "${requestedRole}" is not delivered in phase 0`,
});

export function createPhase0ModelRouter(options: Phase0ModelRouterOptions): Phase0ModelRouter {
  const resolveBaselineHealth =
    options.resolveBaselineHealth ??
    (() =>
      Promise.resolve({
        [BASELINE_MODEL_PROFILE_ROLE.REFLEX]: { healthy: true },
        [BASELINE_MODEL_PROFILE_ROLE.DELIBERATION]: { healthy: true },
        [BASELINE_MODEL_PROFILE_ROLE.REFLECTION]: { healthy: true },
      }));
  const baselineProfiles =
    options.baselineProfiles ?? createBaselineProfiles(options.fastModelBaseUrl);

  const loadBaselineProfiles = async (): Promise<RuntimeModelProfileRow[]> => {
    const profiles = await options.store.listModelProfiles({
      roles: [
        BASELINE_MODEL_PROFILE_ROLE.REFLEX,
        BASELINE_MODEL_PROFILE_ROLE.DELIBERATION,
        BASELINE_MODEL_PROFILE_ROLE.REFLECTION,
      ],
    });

    return profiles.sort(baselineProfileSorter);
  };

  const resolveHealthIfNeeded = async (
    roles: BaselineModelProfileRole[],
    overrides?: Partial<Record<BaselineModelProfileRole, ModelHealthSummary>>,
  ): Promise<Partial<Record<BaselineModelProfileRole, ModelHealthSummary>>> => {
    if (roles.every((role) => overrides?.[role] !== undefined)) {
      return {};
    }

    return await resolveBaselineHealth();
  };

  return {
    async ensureBaselineProfiles(): Promise<BaselineModelProfileDiagnostic[]> {
      await options.store.ensureModelProfiles(baselineProfiles);
      return await this.getBaselineDiagnostics();
    },

    async getBaselineDiagnostics(
      input?: Pick<BaselineRoutingInput, 'organHealth'>,
    ): Promise<BaselineModelProfileDiagnostic[]> {
      const baselineRoles: BaselineModelProfileRole[] = [
        BASELINE_MODEL_PROFILE_ROLE.REFLEX,
        BASELINE_MODEL_PROFILE_ROLE.DELIBERATION,
        BASELINE_MODEL_PROFILE_ROLE.REFLECTION,
      ];
      const [profiles, resolvedHealth] = await Promise.all([
        loadBaselineProfiles(),
        resolveHealthIfNeeded(baselineRoles, input?.organHealth),
      ]);

      return profiles.map((profile) => {
        const role = profile.role as BaselineModelProfileRole;
        return toBaselineDiagnostic(
          profile,
          toHealthSummary(profile, input?.organHealth?.[role] ?? resolvedHealth[role]),
        );
      });
    },

    async selectProfile(input: BaselineRoutingInput): Promise<BaselineRoutingSelection> {
      const requestedRole =
        input.requestedRole ??
        BASELINE_ROLE_BY_TICK_MODE[input.tickMode] ??
        MODEL_PROFILE_ROLE.REFLEX;

      if (
        requestedRole !== BASELINE_MODEL_PROFILE_ROLE.REFLEX &&
        requestedRole !== BASELINE_MODEL_PROFILE_ROLE.DELIBERATION &&
        requestedRole !== BASELINE_MODEL_PROFILE_ROLE.REFLECTION
      ) {
        return toUnsupportedRole(requestedRole);
      }

      const [profiles, resolvedHealth] = await Promise.all([
        loadBaselineProfiles(),
        resolveHealthIfNeeded([requestedRole], input.organHealth),
      ]);
      const requiredCapabilities = input.requiredCapabilities ?? [];
      const matchingProfiles = profiles.filter((profile) => profile.role === requestedRole);

      if (matchingProfiles.length === 0) {
        return {
          accepted: false,
          reason: 'profile_unavailable',
          detail: `no baseline profile is registered for role "${requestedRole}"`,
        };
      }

      const diagnostics = matchingProfiles.map((profile) =>
        toBaselineDiagnostic(
          profile,
          toHealthSummary(
            profile,
            input.organHealth?.[requestedRole] ?? resolvedHealth[requestedRole],
          ),
          requiredCapabilities,
        ),
      );
      const selected = diagnostics.find((profile) => profile.eligibility === 'eligible');

      if (!selected) {
        const unhealthyProfile = diagnostics.find(
          (profile) => profile.eligibility === 'profile_unhealthy',
        );
        if (unhealthyProfile) {
          return {
            accepted: false,
            reason: 'profile_unhealthy',
            detail: unhealthyProfile.healthSummary.detail ?? `${requestedRole} is unhealthy`,
          };
        }

        const unavailableProfile = diagnostics[0];
        return {
          accepted: false,
          reason: 'profile_unavailable',
          detail:
            unavailableProfile?.capabilities.length && requiredCapabilities.length
              ? `baseline ${requestedRole} profile does not satisfy required capabilities: ${requiredCapabilities.join(', ')}`
              : `baseline ${requestedRole} profile is unavailable`,
        };
      }

      return {
        accepted: true,
        modelProfileId: selected.modelProfileId,
        role: selected.role,
        endpoint: selected.endpoint,
        adapterOf: selected.adapterOf,
        selectionReason: {
          tickMode: input.tickMode,
          taskKind: input.taskKind,
          latencyBudget: input.latencyBudget,
          riskLevel: input.riskLevel,
          contextSize: input.contextSize,
          requiredCapabilities,
          lastEvalScore: input.lastEvalScore ?? null,
          health: selected.healthSummary,
        },
      };
    },

    async admitSpecialistSelection(
      input: SpecialistAdmissionInput,
    ): Promise<SpecialistRoutingAdmissionSelection> {
      if (!options.specialistPolicy) {
        return {
          accepted: false,
          reason: 'specialist_policy_unavailable',
          detail: 'specialist policy service is not configured',
          specialistId: input.specialistId,
          remapped: false,
          fallbackTargetProfileId: null,
          admissionDecisionId: null,
        };
      }

      const admission = await options.specialistPolicy.admitSpecialist(input);
      if (!admission.accepted) {
        return {
          accepted: false,
          reason: 'specialist_admission_refused',
          detail: admission.refusal.detail,
          specialistId: input.specialistId,
          remapped: false,
          fallbackTargetProfileId: admission.refusal.fallbackTargetProfileId,
          admissionDecisionId: admission.decision.decisionId,
        };
      }
      if (admission.deduplicated) {
        return {
          accepted: false,
          reason: 'specialist_admission_replayed',
          detail: `specialist admission ${admission.decision.decisionId} is a replay and cannot authorize a new selection`,
          specialistId: input.specialistId,
          remapped: false,
          fallbackTargetProfileId: admission.decision.fallbackTargetProfileId,
          admissionDecisionId: admission.decision.decisionId,
        };
      }

      return {
        accepted: true,
        specialistId: input.specialistId,
        modelProfileId: admission.decision.selectedModelProfileId ?? input.specialistId,
        admissionDecisionId: admission.decision.decisionId,
        stage: admission.decision.stage ?? admission.policy.allowedStage,
        selectionReason: {
          taskSignature: input.taskSignature,
          policyId: admission.policy.policyId,
          admissionDecisionId: admission.decision.decisionId,
        },
      };
    },
  };
}
