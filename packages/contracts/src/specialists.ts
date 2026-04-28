import type { ServingDependencyServiceId } from './models.ts';

export const SPECIALIST_POLICY_OWNER = 'F-0027' as const;

export const SPECIALIST_ROLLOUT_STAGE = Object.freeze({
  CANDIDATE: 'candidate',
  SHADOW: 'shadow',
  LIMITED_ACTIVE: 'limited-active',
  ACTIVE: 'active',
  STABLE: 'stable',
  RETIRING: 'retiring',
  RETIRED: 'retired',
} as const);

export type SpecialistRolloutStage =
  (typeof SPECIALIST_ROLLOUT_STAGE)[keyof typeof SPECIALIST_ROLLOUT_STAGE];

export const SPECIALIST_ADMISSION_DECISION = Object.freeze({
  ALLOW: 'allow',
  REFUSAL: 'refusal',
} as const);

export type SpecialistAdmissionDecision =
  (typeof SPECIALIST_ADMISSION_DECISION)[keyof typeof SPECIALIST_ADMISSION_DECISION];

export const SPECIALIST_ROLLOUT_EVENT_DECISION = Object.freeze({
  RECORDED: 'recorded',
  REFUSED: 'refused',
} as const);

export type SpecialistRolloutEventDecision =
  (typeof SPECIALIST_ROLLOUT_EVENT_DECISION)[keyof typeof SPECIALIST_ROLLOUT_EVENT_DECISION];

export const SPECIALIST_RETIREMENT_TRIGGER_KIND = Object.freeze({
  DEGRADED: 'degraded',
  STALE: 'stale',
  COST_INEFFECTIVE: 'cost_ineffective',
  UNSAFE: 'unsafe',
  ROLLBACK_TRIGGERED: 'rollback_triggered',
  SUPERSEDED: 'superseded',
  OPERATOR_REQUEST: 'operator_request',
} as const);

export type SpecialistRetirementTriggerKind =
  (typeof SPECIALIST_RETIREMENT_TRIGGER_KIND)[keyof typeof SPECIALIST_RETIREMENT_TRIGGER_KIND];

export const SPECIALIST_EVIDENCE_CLASS = Object.freeze({
  WORKSHOP_PROMOTION: 'workshop_promotion',
  GOVERNOR_DECISION: 'governor_decision',
  SERVING_READINESS: 'serving_readiness',
  RELEASE_EVIDENCE: 'release_evidence',
  HEALTH: 'health',
  ROLLBACK_TARGET: 'rollback_target',
} as const);

export type SpecialistEvidenceClass =
  (typeof SPECIALIST_EVIDENCE_CLASS)[keyof typeof SPECIALIST_EVIDENCE_CLASS];

export const SPECIALIST_REFUSAL_REASON = Object.freeze({
  ORGAN_NOT_FOUND: 'organ_not_found',
  POLICY_NOT_FOUND: 'policy_not_found',
  WORKSHOP_EVIDENCE_MISSING: 'workshop_evidence_missing',
  WORKSHOP_CANDIDATE_INVALID: 'workshop_candidate_invalid',
  GOVERNOR_EVIDENCE_MISSING: 'governor_evidence_missing',
  GOVERNOR_DENIED: 'governor_denied',
  SERVING_READINESS_MISSING: 'serving_readiness_missing',
  SERVING_NOT_READY: 'serving_not_ready',
  RELEASE_EVIDENCE_MISSING: 'release_evidence_missing',
  RELEASE_NOT_READY: 'release_not_ready',
  HEALTH_EVIDENCE_MISSING: 'health_evidence_missing',
  SPECIALIST_UNHEALTHY: 'specialist_unhealthy',
  ROLLBACK_TARGET_MISSING: 'rollback_target_missing',
  SHADOW_NO_LIVE_AUTHORITY: 'shadow_no_live_authority',
  TRAFFIC_LIMIT_EXCEEDED: 'traffic_limit_exceeded',
  RETIRED: 'retired',
  UNSUPPORTED_STAGE: 'unsupported_stage',
  STALE_EVIDENCE: 'stale_evidence',
  FALLBACK_UNAVAILABLE: 'fallback_unavailable',
  CONFLICTING_REQUEST: 'conflicting_request',
  TERMINAL_STAGE_CONFLICT: 'terminal_stage_conflict',
  FOREIGN_OWNER_WRITE_REJECTED: 'foreign_owner_write_rejected',
} as const);

export type SpecialistRefusalReason =
  (typeof SPECIALIST_REFUSAL_REASON)[keyof typeof SPECIALIST_REFUSAL_REASON];

export const SPECIALIST_OWNED_WRITE_SURFACE = Object.freeze({
  ORGANS: 'polyphony_runtime.specialist_organs',
  ROLLOUT_POLICIES: 'polyphony_runtime.specialist_rollout_policies',
  ROLLOUT_EVENTS: 'polyphony_runtime.specialist_rollout_events',
  ADMISSION_DECISIONS: 'polyphony_runtime.specialist_admission_decisions',
  RETIREMENT_DECISIONS: 'polyphony_runtime.specialist_retirement_decisions',
} as const);

export type SpecialistOwnedWriteSurface =
  (typeof SPECIALIST_OWNED_WRITE_SURFACE)[keyof typeof SPECIALIST_OWNED_WRITE_SURFACE];

export const SPECIALIST_FOREIGN_WRITE_SURFACE = Object.freeze({
  MODEL_CANDIDATES: 'polyphony_runtime.model_candidates',
  CANDIDATE_STAGE_EVENTS: 'polyphony_runtime.candidate_stage_events',
  MODEL_REGISTRY: 'polyphony_runtime.model_registry',
  MODEL_PROFILE_HEALTH: 'polyphony_runtime.model_profile_health',
  MODEL_FALLBACK_LINKS: 'polyphony_runtime.model_fallback_links',
  DEVELOPMENT_PROPOSAL_DECISIONS: 'polyphony_runtime.development_proposal_decisions',
  RELEASE_REQUESTS: 'polyphony_runtime.release_requests',
  RELEASE_EVIDENCE: 'polyphony_runtime.release_evidence',
} as const);

export type SpecialistForeignWriteSurface =
  (typeof SPECIALIST_FOREIGN_WRITE_SURFACE)[keyof typeof SPECIALIST_FOREIGN_WRITE_SURFACE];

export type SpecialistOrganRow = {
  specialistId: string;
  taskSignature: string;
  capability: string;
  workshopCandidateId: string;
  promotionPackageRef: string;
  modelProfileId: string;
  serviceId: ServingDependencyServiceId;
  predecessorProfileId: string | null;
  rollbackTargetProfileId: string | null;
  fallbackTargetProfileId: string | null;
  stage: SpecialistRolloutStage;
  statusReason: string;
  currentPolicyId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SpecialistRolloutPolicyRow = {
  policyId: string;
  requestId: string;
  normalizedRequestHash: string;
  specialistId: string;
  governedScope: string;
  allowedStage: SpecialistRolloutStage;
  trafficLimit: number | null;
  requiredEvidenceClassesJson: SpecialistEvidenceClass[];
  healthMaxAgeMs: number | null;
  fallbackTargetProfileId: string | null;
  evidenceRefsJson: string[];
  createdAt: string;
};

export type SpecialistRolloutEventRow = {
  eventId: string;
  requestId: string;
  normalizedRequestHash: string;
  policyId: string;
  specialistId: string;
  fromStage: SpecialistRolloutStage | null;
  toStage: SpecialistRolloutStage;
  decision: SpecialistRolloutEventDecision;
  reasonCode: SpecialistRefusalReason | 'stage_recorded';
  actorRef: string | null;
  evidenceRefsJson: string[];
  createdAt: string;
};

export type SpecialistAdmissionDecisionRow = {
  decisionId: string;
  requestId: string;
  normalizedRequestHash: string;
  specialistId: string;
  taskSignature: string;
  selectedModelProfileId: string | null;
  stage: SpecialistRolloutStage | null;
  decision: SpecialistAdmissionDecision;
  reasonCode: SpecialistRefusalReason | 'admitted';
  fallbackTargetProfileId: string | null;
  evidenceRefsJson: string[];
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

export type SpecialistRetirementDecisionRow = {
  retirementId: string;
  requestId: string;
  normalizedRequestHash: string;
  specialistId: string;
  triggerKind: SpecialistRetirementTriggerKind;
  previousStage: SpecialistRolloutStage;
  replacementSpecialistId: string | null;
  fallbackTargetProfileId: string | null;
  evidenceRefsJson: string[];
  reason: string;
  createdAt: string;
};

export type StructuredSpecialistRefusal = {
  reason: SpecialistRefusalReason;
  specialistId: string;
  taskSignature: string;
  fallbackTargetProfileId: string | null;
  evidenceRefs: string[];
  detail: string;
};

const rolloutStages = new Set<string>(Object.values(SPECIALIST_ROLLOUT_STAGE));
const admissionDecisions = new Set<string>(Object.values(SPECIALIST_ADMISSION_DECISION));
const rolloutEventDecisions = new Set<string>(Object.values(SPECIALIST_ROLLOUT_EVENT_DECISION));
const retirementTriggerKinds = new Set<string>(Object.values(SPECIALIST_RETIREMENT_TRIGGER_KIND));
const evidenceClasses = new Set<string>(Object.values(SPECIALIST_EVIDENCE_CLASS));
const specialistOwnedWriteSurfaces = new Set<string>(Object.values(SPECIALIST_OWNED_WRITE_SURFACE));

export const isSpecialistRolloutStage = (value: string): value is SpecialistRolloutStage =>
  rolloutStages.has(value);

export const isSpecialistLiveStage = (stage: SpecialistRolloutStage): boolean =>
  stage === SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE ||
  stage === SPECIALIST_ROLLOUT_STAGE.ACTIVE ||
  stage === SPECIALIST_ROLLOUT_STAGE.STABLE;

export const isSpecialistTerminalStage = (stage: SpecialistRolloutStage): boolean =>
  stage === SPECIALIST_ROLLOUT_STAGE.RETIRED;

export const isSpecialistAdmissionDecision = (
  value: string,
): value is SpecialistAdmissionDecision => admissionDecisions.has(value);

export const isSpecialistRolloutEventDecision = (
  value: string,
): value is SpecialistRolloutEventDecision => rolloutEventDecisions.has(value);

export const isSpecialistRetirementTriggerKind = (
  value: string,
): value is SpecialistRetirementTriggerKind => retirementTriggerKinds.has(value);

export const isSpecialistEvidenceClass = (value: string): value is SpecialistEvidenceClass =>
  evidenceClasses.has(value);

export const isSpecialistOwnedWriteSurface = (
  value: string,
): value is SpecialistOwnedWriteSurface => specialistOwnedWriteSurfaces.has(value);

export const assertSpecialistOwnedWriteSurface = (surface: string): void => {
  if (!isSpecialistOwnedWriteSurface(surface)) {
    throw new Error(`${SPECIALIST_REFUSAL_REASON.FOREIGN_OWNER_WRITE_REJECTED}: ${surface}`);
  }
};

const assertNonEmptyString = (value: string, field: string): void => {
  if (value.trim().length === 0) {
    throw new Error(`specialist contract requires non-empty ${field}`);
  }
};

const assertTimestamp = (value: string, field: string): void => {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(`specialist contract requires valid ${field}`);
  }
};

const assertPositiveIntegerOrNull = (value: number | null, field: string): void => {
  if (value !== null && (!Number.isInteger(value) || value <= 0)) {
    throw new Error(`specialist contract requires positive integer ${field} or null`);
  }
};

const assertEvidenceClassList = (values: SpecialistEvidenceClass[]): void => {
  for (const value of values) {
    if (!isSpecialistEvidenceClass(value)) {
      throw new Error(`unknown specialist evidence class ${JSON.stringify(value)}`);
    }
  }
};

export const assertValidSpecialistOrgan = (organ: SpecialistOrganRow): void => {
  assertNonEmptyString(organ.specialistId, 'specialistId');
  assertNonEmptyString(organ.taskSignature, 'taskSignature');
  assertNonEmptyString(organ.capability, 'capability');
  assertNonEmptyString(organ.workshopCandidateId, 'workshopCandidateId');
  assertNonEmptyString(organ.promotionPackageRef, 'promotionPackageRef');
  assertNonEmptyString(organ.modelProfileId, 'modelProfileId');
  assertNonEmptyString(organ.serviceId, 'serviceId');
  assertNonEmptyString(organ.statusReason, 'statusReason');
  if (!isSpecialistRolloutStage(organ.stage)) {
    throw new Error(`unknown specialist rollout stage ${JSON.stringify(organ.stage)}`);
  }
  if (isSpecialistLiveStage(organ.stage) && !organ.rollbackTargetProfileId) {
    throw new Error('live specialist organ requires rollbackTargetProfileId');
  }
  assertTimestamp(organ.createdAt, 'createdAt');
  assertTimestamp(organ.updatedAt, 'updatedAt');
};

export const assertValidSpecialistRolloutPolicy = (policy: SpecialistRolloutPolicyRow): void => {
  assertNonEmptyString(policy.policyId, 'policyId');
  assertNonEmptyString(policy.requestId, 'requestId');
  assertNonEmptyString(policy.normalizedRequestHash, 'normalizedRequestHash');
  assertNonEmptyString(policy.specialistId, 'specialistId');
  assertNonEmptyString(policy.governedScope, 'governedScope');
  if (!isSpecialistRolloutStage(policy.allowedStage)) {
    throw new Error(`unknown specialist rollout stage ${JSON.stringify(policy.allowedStage)}`);
  }
  assertPositiveIntegerOrNull(policy.trafficLimit, 'trafficLimit');
  assertPositiveIntegerOrNull(policy.healthMaxAgeMs, 'healthMaxAgeMs');
  if (
    policy.allowedStage === SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE &&
    policy.trafficLimit === null
  ) {
    throw new Error('limited-active specialist policy requires trafficLimit');
  }
  assertEvidenceClassList(policy.requiredEvidenceClassesJson);
  assertTimestamp(policy.createdAt, 'createdAt');
};

export const assertValidSpecialistAdmissionDecision = (
  decision: SpecialistAdmissionDecisionRow,
): void => {
  assertNonEmptyString(decision.decisionId, 'decisionId');
  assertNonEmptyString(decision.requestId, 'requestId');
  assertNonEmptyString(decision.normalizedRequestHash, 'normalizedRequestHash');
  assertNonEmptyString(decision.specialistId, 'specialistId');
  assertNonEmptyString(decision.taskSignature, 'taskSignature');
  if (decision.stage !== null && !isSpecialistRolloutStage(decision.stage)) {
    throw new Error(`unknown specialist admission stage ${JSON.stringify(decision.stage)}`);
  }
  if (!isSpecialistAdmissionDecision(decision.decision)) {
    throw new Error(`unknown specialist admission decision ${JSON.stringify(decision.decision)}`);
  }
  assertTimestamp(decision.createdAt, 'createdAt');
};

export const assertValidSpecialistRetirementDecision = (
  decision: SpecialistRetirementDecisionRow,
): void => {
  assertNonEmptyString(decision.retirementId, 'retirementId');
  assertNonEmptyString(decision.requestId, 'requestId');
  assertNonEmptyString(decision.normalizedRequestHash, 'normalizedRequestHash');
  assertNonEmptyString(decision.specialistId, 'specialistId');
  if (!isSpecialistRetirementTriggerKind(decision.triggerKind)) {
    throw new Error(
      `unknown specialist retirement trigger ${JSON.stringify(decision.triggerKind)}`,
    );
  }
  if (!isSpecialistRolloutStage(decision.previousStage)) {
    throw new Error(`unknown previous specialist stage ${JSON.stringify(decision.previousStage)}`);
  }
  assertNonEmptyString(decision.reason, 'reason');
  assertTimestamp(decision.createdAt, 'createdAt');
};
