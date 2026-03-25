import {
  EXPANDED_MODEL_ROLE,
  EXPANDED_MODEL_SERVICE_ID,
  MODEL_FALLBACK_LINK_KIND,
  MODEL_PROFILE_AVAILABILITY,
  MODEL_PROFILE_QUARANTINE_STATE,
  type ExpandedFallbackLink,
  type ExpandedModelProfile,
  type ExpandedModelProfileHealth,
  type ExpandedModelRole,
  type ExpandedModelServiceId,
  type ModelOrganHealthReportInput,
  type OperatorRicherRegistryHealthSummary,
} from '@yaagi/contracts/models';
import {
  MODEL_PROFILE_STATUS,
  RICHER_MODEL_PROFILE_ROLE,
  type ExpandedFallbackLinkInput,
  type ExpandedModelEcologyStore,
  type ExpandedModelProfileHealthInput,
  type RuntimeModelProfileRow,
  type RuntimeModelProfileSeedInput,
  type RuntimeModelProfileStore,
} from '@yaagi/db';

export const EXPANDED_MODEL_PROFILE_ID = Object.freeze({
  CODE_DEEP: 'code.deep@shared',
  SAFETY_DEEP: 'safety.deep@shared',
  EMBEDDING_POOL: 'embedding.pool@shared',
  RERANKER_POOL: 'reranker.pool@shared',
  CLASSIFIER_POOL: 'classifier.pool@shared',
} as const);

type ServiceProbeResult = {
  availability: ExpandedModelProfileHealth['availability'];
  healthy: boolean | null;
  errorRate: number | null;
  latencyMsP95: number | null;
  detail: string;
};

type ExpandedModelEcologyServiceOptions = {
  deepModelBaseUrl: string;
  poolModelBaseUrl: string;
  modelProfileStore: RuntimeModelProfileStore;
  store: ExpandedModelEcologyStore;
  probeService?: (input: {
    serviceId: ExpandedModelServiceId;
    baseUrl: string;
  }) => Promise<ServiceProbeResult>;
};

export type ExpandedModelEcologyService = {
  ensureExpandedCatalog(): Promise<ExpandedModelProfile[]>;
  syncRicherSourceDiagnostics(): Promise<OperatorRicherRegistryHealthSummary>;
  getOperatorRicherRegistryHealthSummary(): Promise<OperatorRicherRegistryHealthSummary>;
  getModelOrganHealthReportInput(): Promise<ModelOrganHealthReportInput>;
};

const EXPANDED_MODEL_ROLE_ORDER: ExpandedModelRole[] = [
  EXPANDED_MODEL_ROLE.CLASSIFIER,
  EXPANDED_MODEL_ROLE.CODE,
  EXPANDED_MODEL_ROLE.EMBEDDING,
  EXPANDED_MODEL_ROLE.RERANKER,
  EXPANDED_MODEL_ROLE.SAFETY,
];

const DEFAULT_FALLBACK_REASON = 'no delivered richer fallback target';

const expandedProfileSorter = (
  left: RuntimeModelProfileRow,
  right: RuntimeModelProfileRow,
): number => {
  const leftRoleIndex = EXPANDED_MODEL_ROLE_ORDER.indexOf(left.role as ExpandedModelRole);
  const rightRoleIndex = EXPANDED_MODEL_ROLE_ORDER.indexOf(right.role as ExpandedModelRole);
  if (leftRoleIndex !== rightRoleIndex) {
    return leftRoleIndex - rightRoleIndex;
  }

  return left.modelProfileId.localeCompare(right.modelProfileId);
};

const toExpandedModelServiceId = (value: string): ExpandedModelServiceId => {
  if (
    value === EXPANDED_MODEL_SERVICE_ID.VLLM_DEEP ||
    value === EXPANDED_MODEL_SERVICE_ID.VLLM_POOL
  ) {
    return value;
  }

  throw new Error(`unsupported expanded model service id ${JSON.stringify(value)}`);
};

const createExpandedProfiles = (input: {
  deepModelBaseUrl: string;
  poolModelBaseUrl: string;
}): RuntimeModelProfileSeedInput[] => [
  {
    modelProfileId: EXPANDED_MODEL_PROFILE_ID.CODE_DEEP,
    role: RICHER_MODEL_PROFILE_ROLE.CODE,
    serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_DEEP,
    endpoint: input.deepModelBaseUrl,
    baseModel: 'model-deep',
    capabilities: ['code', 'structured-output', 'text-generation'],
    costJson: { class: 'shared-deep' },
    healthJson: { owner: 'F-0014', serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_DEEP },
    status: MODEL_PROFILE_STATUS.ACTIVE,
  },
  {
    modelProfileId: EXPANDED_MODEL_PROFILE_ID.SAFETY_DEEP,
    role: RICHER_MODEL_PROFILE_ROLE.SAFETY,
    serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_DEEP,
    endpoint: input.deepModelBaseUrl,
    baseModel: 'model-deep',
    capabilities: ['safety', 'policy-check', 'refusal-analysis'],
    costJson: { class: 'shared-deep' },
    healthJson: { owner: 'F-0014', serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_DEEP },
    status: MODEL_PROFILE_STATUS.ACTIVE,
  },
  {
    modelProfileId: EXPANDED_MODEL_PROFILE_ID.EMBEDDING_POOL,
    role: RICHER_MODEL_PROFILE_ROLE.EMBEDDING,
    serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_POOL,
    endpoint: input.poolModelBaseUrl,
    baseModel: 'model-pool',
    capabilities: ['embedding'],
    costJson: { class: 'shared-pool' },
    healthJson: { owner: 'F-0014', serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_POOL },
    status: MODEL_PROFILE_STATUS.ACTIVE,
  },
  {
    modelProfileId: EXPANDED_MODEL_PROFILE_ID.RERANKER_POOL,
    role: RICHER_MODEL_PROFILE_ROLE.RERANKER,
    serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_POOL,
    endpoint: input.poolModelBaseUrl,
    baseModel: 'model-pool',
    capabilities: ['reranker'],
    costJson: { class: 'shared-pool' },
    healthJson: { owner: 'F-0014', serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_POOL },
    status: MODEL_PROFILE_STATUS.ACTIVE,
  },
  {
    modelProfileId: EXPANDED_MODEL_PROFILE_ID.CLASSIFIER_POOL,
    role: RICHER_MODEL_PROFILE_ROLE.CLASSIFIER,
    serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_POOL,
    endpoint: input.poolModelBaseUrl,
    baseModel: 'model-pool',
    capabilities: ['classifier'],
    costJson: { class: 'shared-pool' },
    healthJson: { owner: 'F-0014', serviceId: EXPANDED_MODEL_SERVICE_ID.VLLM_POOL },
    status: MODEL_PROFILE_STATUS.ACTIVE,
  },
];

const createDefaultFallbackLinks = (
  profiles: RuntimeModelProfileRow[],
): ExpandedFallbackLinkInput[] =>
  profiles.map((profile) => ({
    modelProfileId: profile.modelProfileId,
    fallbackTargetProfileId: null,
    linkKind: MODEL_FALLBACK_LINK_KIND.PREDECESSOR,
    allowed: false,
    reason: DEFAULT_FALLBACK_REASON,
  }));

const defaultProbeService = async (input: {
  serviceId: ExpandedModelServiceId;
  baseUrl: string;
}): Promise<ServiceProbeResult> => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 750);

  try {
    const response = await fetch(new URL('models', `${input.baseUrl}/`), {
      method: 'GET',
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;

    if (response.ok) {
      return {
        availability: MODEL_PROFILE_AVAILABILITY.AVAILABLE,
        healthy: true,
        errorRate: 0,
        latencyMsP95: latencyMs,
        detail: `${input.serviceId} is reachable`,
      };
    }

    return {
      availability: MODEL_PROFILE_AVAILABILITY.DEGRADED,
      healthy: false,
      errorRate: 1,
      latencyMsP95: latencyMs,
      detail: `${input.serviceId} probe returned ${response.status}`,
    };
  } catch (error) {
    return {
      availability: MODEL_PROFILE_AVAILABILITY.UNAVAILABLE,
      healthy: false,
      errorRate: 1,
      latencyMsP95: null,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const toExpandedProfile = (profile: RuntimeModelProfileRow): ExpandedModelProfile => ({
  modelProfileId: profile.modelProfileId,
  role: profile.role as ExpandedModelRole,
  serviceId: toExpandedModelServiceId(profile.serviceId),
  endpoint: profile.endpoint,
  baseModel: profile.baseModel,
  capabilities: profile.capabilitiesJson,
  status: profile.status,
});

const summarizeDiagnostics = (input: {
  profiles: RuntimeModelProfileRow[];
  healthRows: ExpandedModelProfileHealth[];
  fallbackLinks: ExpandedFallbackLink[];
}): OperatorRicherRegistryHealthSummary => {
  const healthByProfileId = new Map(
    input.healthRows.map((row) => [row.modelProfileId, row] as const),
  );
  const fallbackByProfileId = new Map(
    input.fallbackLinks.map((row) => [row.modelProfileId, row] as const),
  );

  const generatedAt = input.healthRows.reduce<string | null>((latest, row) => {
    if (!latest || row.checkedAt > latest) {
      return row.checkedAt;
    }
    return latest;
  }, null);

  const organs = [...input.profiles].sort(expandedProfileSorter).map((profile) => {
    const health = healthByProfileId.get(profile.modelProfileId);
    const fallback = fallbackByProfileId.get(profile.modelProfileId);
    return {
      modelProfileId: profile.modelProfileId,
      role: profile.role as ExpandedModelRole,
      serviceId: health?.serviceId ?? toExpandedModelServiceId(profile.serviceId),
      availability: health?.availability ?? MODEL_PROFILE_AVAILABILITY.UNAVAILABLE,
      quarantineState: health?.quarantineState ?? MODEL_PROFILE_QUARANTINE_STATE.ACTIVE,
      fallbackTargetProfileId: fallback?.fallbackTargetProfileId ?? null,
      errorRate: health?.errorRate ?? null,
      latencyMsP95: health?.latencyMsP95 ?? null,
    };
  });

  return {
    available: true,
    owner: 'F-0014',
    generatedAt,
    organs,
  };
};

export function createExpandedModelEcologyService(
  options: ExpandedModelEcologyServiceOptions,
): ExpandedModelEcologyService {
  const probeService = options.probeService ?? defaultProbeService;
  const seedProfiles = createExpandedProfiles({
    deepModelBaseUrl: options.deepModelBaseUrl,
    poolModelBaseUrl: options.poolModelBaseUrl,
  });
  const richerRoles = Object.values(RICHER_MODEL_PROFILE_ROLE);

  const loadExpandedProfiles = async (): Promise<RuntimeModelProfileRow[]> =>
    (await options.modelProfileStore.listModelProfiles({ roles: richerRoles })).sort(
      expandedProfileSorter,
    );
  const ensureExpandedCatalog = async (): Promise<ExpandedModelProfile[]> => {
    await options.modelProfileStore.ensureModelProfiles(seedProfiles);
    const profiles = await loadExpandedProfiles();
    await options.store.replaceFallbackLinks(createDefaultFallbackLinks(profiles));
    return profiles.map(toExpandedProfile);
  };
  const getOperatorRicherRegistryHealthSummary =
    async (): Promise<OperatorRicherRegistryHealthSummary> => {
      const profiles = await loadExpandedProfiles();
      const [healthRows, fallbackLinks] = await Promise.all([
        options.store.listProfileHealth({
          modelProfileIds: profiles.map((profile) => profile.modelProfileId),
        }),
        options.store.listFallbackLinks({
          modelProfileIds: profiles.map((profile) => profile.modelProfileId),
        }),
      ]);

      return summarizeDiagnostics({
        profiles,
        healthRows,
        fallbackLinks,
      });
    };
  const syncRicherSourceDiagnostics = async (): Promise<OperatorRicherRegistryHealthSummary> => {
    await ensureExpandedCatalog();
    const profiles = await loadExpandedProfiles();
    const serviceBaseUrls = new Map<ExpandedModelServiceId, string>([
      [EXPANDED_MODEL_SERVICE_ID.VLLM_DEEP, options.deepModelBaseUrl],
      [EXPANDED_MODEL_SERVICE_ID.VLLM_POOL, options.poolModelBaseUrl],
    ]);
    const uniqueServiceIds = [...new Set(profiles.map((profile) => profile.serviceId))];
    const probeResults = new Map<string, ServiceProbeResult>();

    for (const serviceId of uniqueServiceIds) {
      const baseUrl =
        serviceBaseUrls.get(serviceId as ExpandedModelServiceId) ??
        profiles.find((profile) => profile.serviceId === serviceId)?.endpoint ??
        options.poolModelBaseUrl;
      probeResults.set(
        serviceId,
        await probeService({
          serviceId: serviceId as ExpandedModelServiceId,
          baseUrl,
        }),
      );
    }

    await options.store.upsertProfileHealth(
      profiles.map((profile): ExpandedModelProfileHealthInput => {
        const probe = probeResults.get(profile.serviceId);
        const availability = probe?.availability ?? MODEL_PROFILE_AVAILABILITY.UNAVAILABLE;
        return {
          modelProfileId: profile.modelProfileId,
          serviceId: toExpandedModelServiceId(profile.serviceId),
          availability,
          quarantineState:
            availability === MODEL_PROFILE_AVAILABILITY.AVAILABLE
              ? MODEL_PROFILE_QUARANTINE_STATE.CLEAR
              : MODEL_PROFILE_QUARANTINE_STATE.ACTIVE,
          healthy: probe?.healthy ?? false,
          errorRate: probe?.errorRate ?? 1,
          latencyMsP95: probe?.latencyMsP95 ?? null,
          checkedAt: new Date().toISOString(),
          sourceJson: {
            owner: 'F-0014',
            detail: probe?.detail ?? 'service probe not available',
            endpoint: profile.endpoint,
            baseModel: profile.baseModel,
            capabilities: profile.capabilitiesJson,
          },
        };
      }),
    );

    return await getOperatorRicherRegistryHealthSummary();
  };
  const getModelOrganHealthReportInput = async (): Promise<ModelOrganHealthReportInput> => {
    const summary = await getOperatorRicherRegistryHealthSummary();
    return {
      generatedAt: summary.generatedAt ?? new Date().toISOString(),
      profiles: summary.organs.map((organ) => ({
        modelProfileId: organ.modelProfileId,
        role: organ.role,
        serviceId: organ.serviceId,
        availability: organ.availability,
        quarantineState: organ.quarantineState,
        fallbackTargetProfileId: organ.fallbackTargetProfileId,
        errorRate: organ.errorRate,
        latencyMsP95: organ.latencyMsP95,
      })),
    };
  };

  return {
    ensureExpandedCatalog,
    syncRicherSourceDiagnostics,
    getOperatorRicherRegistryHealthSummary,
    getModelOrganHealthReportInput,
  };
}
