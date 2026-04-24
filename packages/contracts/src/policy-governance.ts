import type { SensorSource, StimulusPriority } from './perception.ts';

export const POLICY_PROFILE_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  RETIRED: 'retired',
  BLOCKED: 'blocked',
} as const);

export type PolicyProfileStatus =
  (typeof POLICY_PROFILE_STATUS)[keyof typeof POLICY_PROFILE_STATUS];

export const POLICY_GOVERNANCE_SCOPE = Object.freeze({
  CONSULTANT_ADMISSION: 'consultant_admission',
  PERCEPTION_INTAKE: 'perception_intake',
  HUMAN_GATE: 'human_gate',
  PHASE6_AUTONOMY: 'phase6_autonomy',
} as const);

export type PolicyGovernanceScope =
  (typeof POLICY_GOVERNANCE_SCOPE)[keyof typeof POLICY_GOVERNANCE_SCOPE];

export const POLICY_ACTIVATION_DECISION = Object.freeze({
  ACTIVATE: 'activate',
  DEACTIVATE: 'deactivate',
  REFUSE: 'refuse',
} as const);

export type PolicyActivationDecision =
  (typeof POLICY_ACTIVATION_DECISION)[keyof typeof POLICY_ACTIVATION_DECISION];

export const CONSULTANT_KIND = Object.freeze({
  EXTERNAL_LLM: 'external_llm',
  EXTERNAL_REVIEWER: 'external_reviewer',
} as const);

export type ConsultantKind = (typeof CONSULTANT_KIND)[keyof typeof CONSULTANT_KIND];

export const CONSULTANT_ADMISSION_DECISION = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  REFUSAL: 'refusal',
} as const);

export type ConsultantAdmissionDecision =
  (typeof CONSULTANT_ADMISSION_DECISION)[keyof typeof CONSULTANT_ADMISSION_DECISION];

export const PERCEPTION_POLICY_OUTCOME = Object.freeze({
  ACCEPTED: 'accepted',
  DEGRADED: 'degraded',
  REFUSED: 'refused',
  HUMAN_GATED: 'human_gated',
} as const);

export type PerceptionPolicyOutcome =
  (typeof PERCEPTION_POLICY_OUTCOME)[keyof typeof PERCEPTION_POLICY_OUTCOME];

export const POLICY_REFUSAL_REASON = Object.freeze({
  MISSING_POLICY_PROFILE: 'missing_policy_profile',
  AMBIGUOUS_ACTIVE_PROFILE: 'ambiguous_active_profile',
  POLICY_PROFILE_NOT_ACTIVE: 'policy_profile_not_active',
  ACTIVATION_EVIDENCE_MISSING: 'activation_evidence_missing',
  CALLER_EVIDENCE_MISSING: 'caller_evidence_missing',
  GOVERNOR_EVIDENCE_MISSING: 'governor_evidence_missing',
  PERIMETER_EVIDENCE_MISSING: 'perimeter_evidence_missing',
  REPORTING_EVIDENCE_MISSING: 'reporting_evidence_missing',
  STALE_EVIDENCE: 'stale_evidence',
  MISSING_ADMISSION_DECISION: 'missing_admission_decision',
  UNSUPPORTED_CONSULTANT_KIND: 'unsupported_consultant_kind',
  CONSULTANT_UNHEALTHY: 'consultant_unhealthy',
  EXTERNAL_CONSULTANT_DISABLED: 'external_consultant_disabled',
  AUDIT_UNAVAILABLE: 'audit_unavailable',
  EVIDENCE_UNAVAILABLE: 'evidence_unavailable',
  FOREIGN_OWNER_WRITE_REJECTED: 'foreign_owner_write_rejected',
} as const);

export type PolicyRefusalReason =
  (typeof POLICY_REFUSAL_REASON)[keyof typeof POLICY_REFUSAL_REASON];

export const PHASE6_GOVERNANCE_EVENT_KIND = Object.freeze({
  POLICY_PROFILE_REGISTERED: 'policy_profile_registered',
  POLICY_ACTIVATION_DECIDED: 'policy_activation_decided',
  CONSULTANT_ADMISSION_DECIDED: 'consultant_admission_decided',
  PERCEPTION_POLICY_DECIDED: 'perception_policy_decided',
  GOVERNANCE_EVIDENCE_RECORDED: 'governance_evidence_recorded',
} as const);

export type Phase6GovernanceEventKind =
  (typeof PHASE6_GOVERNANCE_EVENT_KIND)[keyof typeof PHASE6_GOVERNANCE_EVENT_KIND];

export const POLICY_GOVERNANCE_OWNED_WRITE_SURFACE = Object.freeze({
  POLICY_PROFILES: 'polyphony_runtime.policy_profiles',
  POLICY_PROFILE_ACTIVATIONS: 'polyphony_runtime.policy_profile_activations',
  CONSULTANT_ADMISSION_DECISIONS: 'polyphony_runtime.consultant_admission_decisions',
  PERCEPTION_POLICY_DECISIONS: 'polyphony_runtime.perception_policy_decisions',
  PHASE6_GOVERNANCE_EVENTS: 'polyphony_runtime.phase6_governance_events',
} as const);

export type PolicyGovernanceOwnedWriteSurface =
  (typeof POLICY_GOVERNANCE_OWNED_WRITE_SURFACE)[keyof typeof POLICY_GOVERNANCE_OWNED_WRITE_SURFACE];

export const POLICY_GOVERNANCE_FOREIGN_WRITE_SURFACE = Object.freeze({
  STIMULUS_INBOX: 'polyphony_runtime.stimulus_inbox',
  TICKS: 'polyphony_runtime.ticks',
  MODEL_REGISTRY: 'polyphony_runtime.model_registry',
  MODEL_PROFILE_HEALTH: 'polyphony_runtime.model_profile_health',
  MODEL_FALLBACK_LINKS: 'polyphony_runtime.model_fallback_links',
  DEVELOPMENT_FREEZES: 'polyphony_runtime.development_freezes',
  DEVELOPMENT_PROPOSALS: 'polyphony_runtime.development_proposals',
  DEVELOPMENT_PROPOSAL_DECISIONS: 'polyphony_runtime.development_proposal_decisions',
  PERIMETER_DECISIONS: 'polyphony_runtime.perimeter_decisions',
  OPERATOR_AUTH_AUDIT_EVENTS: 'polyphony_runtime.operator_auth_audit_events',
  REPORT_RUNS: 'polyphony_runtime.report_runs',
  LIFECYCLE_EVENTS: 'polyphony_runtime.lifecycle_events',
} as const);

export type PolicyGovernanceForeignWriteSurface =
  (typeof POLICY_GOVERNANCE_FOREIGN_WRITE_SURFACE)[keyof typeof POLICY_GOVERNANCE_FOREIGN_WRITE_SURFACE];

export type PolicyActivationRequirements = {
  callerAdmissionEvidence: boolean;
  governorEvidence: boolean;
  perimeterEvidence: boolean;
  reportingEvidence: boolean;
  maxEvidenceAgeMs: number | null;
};

export type PolicyProfileRules = {
  externalConsultantsEnabled: boolean;
  supportedConsultantKinds: ConsultantKind[];
  defaultPerceptionOutcome: PerceptionPolicyOutcome;
};

export type PolicyProfileRow = {
  profileId: string;
  profileVersion: string;
  status: PolicyProfileStatus;
  governedScopesJson: PolicyGovernanceScope[];
  activationRequirementsJson: PolicyActivationRequirements;
  rulesJson: PolicyProfileRules;
  createdAt: string;
  updatedAt: string;
};

export type PolicyProfileActivationRow = {
  activationId: string;
  requestId: string;
  normalizedRequestHash: string;
  profileId: string;
  profileVersion: string;
  scope: PolicyGovernanceScope;
  decision: PolicyActivationDecision;
  reasonCode: PolicyRefusalReason | 'activated' | 'deactivated';
  actorRef: string | null;
  evidenceRefsJson: string[];
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
};

export type ConsultantAdmissionDecisionRow = {
  decisionId: string;
  requestId: string;
  normalizedRequestHash: string;
  profileId: string | null;
  profileVersion: string | null;
  consultantKind: string;
  targetScope: string;
  decision: ConsultantAdmissionDecision;
  reasonCode: PolicyRefusalReason | 'admitted';
  selectedModelProfileId: string | null;
  healthRef: string | null;
  evidenceRefsJson: string[];
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

export type PerceptionPolicyDecisionRow = {
  decisionId: string;
  requestId: string;
  normalizedRequestHash: string;
  stimulusId: string;
  sourceKind: SensorSource;
  priority: StimulusPriority;
  profileId: string | null;
  profileVersion: string | null;
  outcome: PerceptionPolicyOutcome;
  reasonCode: PolicyRefusalReason | 'policy_matched';
  evidenceRefsJson: string[];
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

export type Phase6GovernanceEventRow = {
  eventId: string;
  eventKind: Phase6GovernanceEventKind;
  sourceRef: string;
  profileId: string | null;
  profileVersion: string | null;
  decisionRef: string | null;
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

export type StructuredPolicyRefusal = {
  reason: PolicyRefusalReason;
  targetPath: string;
  policyProfileRef: string | null;
  evidenceRefs: string[];
  detail: string;
};

const policyProfileStatuses = new Set<string>(Object.values(POLICY_PROFILE_STATUS));
const policyGovernanceScopes = new Set<string>(Object.values(POLICY_GOVERNANCE_SCOPE));
const policyActivationDecisions = new Set<string>(Object.values(POLICY_ACTIVATION_DECISION));
const consultantKinds = new Set<string>(Object.values(CONSULTANT_KIND));
const consultantAdmissionDecisions = new Set<string>(Object.values(CONSULTANT_ADMISSION_DECISION));
const perceptionPolicyOutcomes = new Set<string>(Object.values(PERCEPTION_POLICY_OUTCOME));
const phase6GovernanceEventKinds = new Set<string>(Object.values(PHASE6_GOVERNANCE_EVENT_KIND));
const policyGovernanceOwnedWriteSurfaces = new Set<string>(
  Object.values(POLICY_GOVERNANCE_OWNED_WRITE_SURFACE),
);

export const isPolicyProfileStatus = (value: string): value is PolicyProfileStatus =>
  policyProfileStatuses.has(value);

export const isPolicyGovernanceScope = (value: string): value is PolicyGovernanceScope =>
  policyGovernanceScopes.has(value);

export const isPolicyActivationDecision = (value: string): value is PolicyActivationDecision =>
  policyActivationDecisions.has(value);

export const isConsultantKind = (value: string): value is ConsultantKind =>
  consultantKinds.has(value);

export const isConsultantAdmissionDecision = (
  value: string,
): value is ConsultantAdmissionDecision => consultantAdmissionDecisions.has(value);

export const isPerceptionPolicyOutcome = (value: string): value is PerceptionPolicyOutcome =>
  perceptionPolicyOutcomes.has(value);

export const isPhase6GovernanceEventKind = (value: string): value is Phase6GovernanceEventKind =>
  phase6GovernanceEventKinds.has(value);

export const isPolicyGovernanceOwnedWriteSurface = (
  value: string,
): value is PolicyGovernanceOwnedWriteSurface => policyGovernanceOwnedWriteSurfaces.has(value);

export const assertPolicyGovernanceOwnedWriteSurface = (surface: string): void => {
  if (!isPolicyGovernanceOwnedWriteSurface(surface)) {
    throw new Error(`${POLICY_REFUSAL_REASON.FOREIGN_OWNER_WRITE_REJECTED}: ${surface}`);
  }
};

const assertNonEmptyString = (value: string, field: string): void => {
  if (value.trim().length === 0) {
    throw new Error(`policy governance contract requires non-empty ${field}`);
  }
};

const assertTimestamp = (value: string, field: string): void => {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(`policy governance contract requires valid ${field}`);
  }
};

export const assertValidPolicyProfile = (profile: PolicyProfileRow): void => {
  assertNonEmptyString(profile.profileId, 'profileId');
  assertNonEmptyString(profile.profileVersion, 'profileVersion');
  if (!isPolicyProfileStatus(profile.status)) {
    throw new Error(`unknown policy profile status ${JSON.stringify(profile.status)}`);
  }
  if (profile.governedScopesJson.length === 0) {
    throw new Error('policy profile requires at least one governed scope');
  }
  for (const scope of profile.governedScopesJson) {
    if (!isPolicyGovernanceScope(scope)) {
      throw new Error(`unknown policy governance scope ${JSON.stringify(scope)}`);
    }
  }
  if (
    profile.activationRequirementsJson.maxEvidenceAgeMs !== null &&
    (!Number.isInteger(profile.activationRequirementsJson.maxEvidenceAgeMs) ||
      profile.activationRequirementsJson.maxEvidenceAgeMs <= 0)
  ) {
    throw new Error('policy profile maxEvidenceAgeMs must be a positive integer or null');
  }
  for (const kind of profile.rulesJson.supportedConsultantKinds) {
    if (!isConsultantKind(kind)) {
      throw new Error(`unknown consultant kind ${JSON.stringify(kind)}`);
    }
  }
  if (!isPerceptionPolicyOutcome(profile.rulesJson.defaultPerceptionOutcome)) {
    throw new Error(
      `unknown perception policy outcome ${JSON.stringify(
        profile.rulesJson.defaultPerceptionOutcome,
      )}`,
    );
  }
  assertTimestamp(profile.createdAt, 'createdAt');
  assertTimestamp(profile.updatedAt, 'updatedAt');
};
