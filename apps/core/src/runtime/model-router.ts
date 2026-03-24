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
  endpoint: string;
  baseModel: string;
  adapterOf: string | null;
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

export type Phase0ModelRouter = {
  ensureBaselineProfiles(): Promise<BaselineModelProfileDiagnostic[]>;
  selectProfile(input: BaselineRoutingInput): Promise<BaselineRoutingSelection>;
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

const createBaselineProfiles = (fastModelBaseUrl: string): RuntimeModelProfileSeedInput[] => [
  {
    modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
    role: MODEL_PROFILE_ROLE.REFLEX,
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
    endpoint: profile.endpoint,
    baseModel: profile.baseModel,
    adapterOf: profile.adapterOf,
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

  return {
    async ensureBaselineProfiles(): Promise<BaselineModelProfileDiagnostic[]> {
      await options.store.ensureModelProfiles(baselineProfiles);
      return await this.getBaselineDiagnostics();
    },

    async getBaselineDiagnostics(
      input?: Pick<BaselineRoutingInput, 'organHealth'>,
    ): Promise<BaselineModelProfileDiagnostic[]> {
      const [profiles, resolvedHealth] = await Promise.all([
        loadBaselineProfiles(),
        resolveBaselineHealth(),
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
        resolveBaselineHealth(),
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
  };
}
