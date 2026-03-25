export const EXPANDED_MODEL_ROLE = Object.freeze({
  CODE: 'code',
  EMBEDDING: 'embedding',
  RERANKER: 'reranker',
  CLASSIFIER: 'classifier',
  SAFETY: 'safety',
} as const);

export type ExpandedModelRole = (typeof EXPANDED_MODEL_ROLE)[keyof typeof EXPANDED_MODEL_ROLE];

export const EXPANDED_MODEL_SERVICE_ID = Object.freeze({
  VLLM_DEEP: 'vllm-deep',
  VLLM_POOL: 'vllm-pool',
} as const);

export type ExpandedModelServiceId =
  (typeof EXPANDED_MODEL_SERVICE_ID)[keyof typeof EXPANDED_MODEL_SERVICE_ID];

export const MODEL_PROFILE_AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  DEGRADED: 'degraded',
  UNAVAILABLE: 'unavailable',
} as const);

export type ModelProfileAvailability =
  (typeof MODEL_PROFILE_AVAILABILITY)[keyof typeof MODEL_PROFILE_AVAILABILITY];

export const MODEL_PROFILE_QUARANTINE_STATE = Object.freeze({
  CLEAR: 'clear',
  ACTIVE: 'active',
} as const);

export type ModelProfileQuarantineState =
  (typeof MODEL_PROFILE_QUARANTINE_STATE)[keyof typeof MODEL_PROFILE_QUARANTINE_STATE];

export const MODEL_FALLBACK_LINK_KIND = Object.freeze({
  PREDECESSOR: 'predecessor',
  DEGRADED_FALLBACK: 'degraded_fallback',
} as const);

export type ModelFallbackLinkKind =
  (typeof MODEL_FALLBACK_LINK_KIND)[keyof typeof MODEL_FALLBACK_LINK_KIND];

export type ExpandedModelProfile = {
  modelProfileId: string;
  role: ExpandedModelRole;
  serviceId: ExpandedModelServiceId;
  endpoint: string;
  baseModel: string;
  capabilities: string[];
  status: 'active' | 'degraded' | 'disabled';
};

export type ExpandedModelProfileHealth = {
  modelProfileId: string;
  serviceId: ExpandedModelServiceId;
  availability: ModelProfileAvailability;
  quarantineState: ModelProfileQuarantineState;
  healthy: boolean | null;
  errorRate: number | null;
  latencyMsP95: number | null;
  checkedAt: string;
  sourceJson: Record<string, unknown>;
};

export type ExpandedFallbackLink = {
  modelProfileId: string;
  fallbackTargetProfileId: string | null;
  linkKind: ModelFallbackLinkKind;
  allowed: boolean;
  reason: string;
  updatedAt: string;
};

export type OperatorRicherRegistryHealthSummary = {
  available: boolean;
  owner: 'F-0014';
  generatedAt: string | null;
  organs: Array<{
    modelProfileId: string;
    role: ExpandedModelRole;
    serviceId: ExpandedModelServiceId;
    availability: ModelProfileAvailability;
    quarantineState: ModelProfileQuarantineState;
    fallbackTargetProfileId: string | null;
    errorRate: number | null;
    latencyMsP95: number | null;
  }>;
};

export type ModelOrganHealthReportInput = {
  generatedAt: string;
  profiles: Array<{
    modelProfileId: string;
    role: ExpandedModelRole;
    serviceId: ExpandedModelServiceId;
    availability: ModelProfileAvailability;
    quarantineState: ModelProfileQuarantineState;
    fallbackTargetProfileId: string | null;
    errorRate: number | null;
    latencyMsP95: number | null;
  }>;
};
