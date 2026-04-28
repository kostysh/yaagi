import { createHash } from 'node:crypto';
import type { ServingDependencyState } from '@yaagi/contracts/models';
import {
  SPECIALIST_ADMISSION_DECISION,
  SPECIALIST_EVIDENCE_CLASS,
  SPECIALIST_REFUSAL_REASON,
  SPECIALIST_ROLLOUT_STAGE,
  isSpecialistLiveStage,
  type SpecialistAdmissionDecisionRow,
  type SpecialistRefusalReason,
  type SpecialistRetirementDecisionRow,
  type SpecialistRetirementTriggerKind,
  type SpecialistRolloutPolicyRow,
  type SpecialistRolloutStage,
  type StructuredSpecialistRefusal,
} from '@yaagi/contracts/specialists';
import { WORKSHOP_CANDIDATE_KIND, type WorkshopPromotionPackage } from '@yaagi/contracts/workshop';
import type {
  RecordSpecialistAdmissionDecisionInput,
  SpecialistPolicyStore,
  SpecialistRequestRecordResult,
} from '@yaagi/db';

type SpecialistClock = () => string;

export type SpecialistGovernorEvidence = {
  decisionRef: string;
  approved: boolean;
  scope: string;
  observedAt: string;
};

export type SpecialistReleaseEvidence = {
  evidenceRef: string;
  ready: boolean;
  observedAt: string;
  deploymentIdentity: string;
  modelServingReadinessRef: string;
  governorEvidenceRef: string;
  lifecycleRollbackTargetRef: string;
  fallbackTargetProfileId: string;
  artifactUri: string;
  artifactDescriptorPath: string;
  runtimeArtifactRoot: string;
  specialistId: string;
  modelProfileId: string;
  serviceId: string;
  policyId: string;
  rolloutStage: SpecialistRolloutStage;
};

export type SpecialistHealthEvidence = {
  healthRef: string;
  healthy: boolean;
  observedAt: string;
  detail?: string;
};

export type SpecialistFallbackReadiness = {
  fallbackTargetProfileId: string;
  available: boolean;
  evidenceRef: string;
  observedAt: string;
};

export type SpecialistPolicyEvidencePorts = {
  getWorkshopPromotionPackage(input: {
    candidateId: string;
    promotionPackageRef: string;
  }): Promise<WorkshopPromotionPackage | null>;
  getGovernorDecision(decisionRef: string): Promise<SpecialistGovernorEvidence | null>;
  getServingDependencyState(input: {
    serviceId: string;
    modelProfileId: string;
    artifactUri: string;
    readinessRef?: string;
  }): Promise<ServingDependencyState | null>;
  getReleaseEvidence(evidenceRef: string): Promise<SpecialistReleaseEvidence | null>;
  getHealthEvidence(input: {
    modelProfileId: string;
    healthRef?: string;
  }): Promise<SpecialistHealthEvidence | null>;
  getFallbackReadiness(input: {
    fallbackTargetProfileId: string;
  }): Promise<SpecialistFallbackReadiness | null>;
};

export type SpecialistAdmissionEvidenceRefs = {
  governorDecisionRef?: string;
  servingReadinessRef?: string;
  releaseEvidenceRef?: string;
  healthRef?: string;
  fallbackReadinessRef?: string;
};

export type SpecialistAdmissionInput = {
  requestId: string;
  specialistId: string;
  taskSignature: string;
  selectedModelProfileId: string | null;
  requestedAt: string;
  evidenceRefs: SpecialistAdmissionEvidenceRefs;
  payloadJson?: Record<string, unknown>;
};

export type SpecialistAdmissionResult =
  | {
      accepted: true;
      deduplicated: boolean;
      decision: SpecialistAdmissionDecisionRow;
      policy: SpecialistRolloutPolicyRow;
    }
  | {
      accepted: false;
      deduplicated: boolean;
      decision: SpecialistAdmissionDecisionRow;
      refusal: StructuredSpecialistRefusal;
      policy: SpecialistRolloutPolicyRow | null;
    };

export type SpecialistExecutionResult<T> =
  | {
      accepted: true;
      specialistInvoked: true;
      admission: Extract<SpecialistAdmissionResult, { accepted: true }>;
      result: T;
    }
  | {
      accepted: true;
      specialistInvoked: false;
      replayed: true;
      admission: Extract<SpecialistAdmissionResult, { accepted: true }>;
    }
  | {
      accepted: false;
      specialistInvoked: false;
      admission: Extract<SpecialistAdmissionResult, { accepted: false }>;
    };

export type RetireSpecialistInput = {
  requestId: string;
  specialistId: string;
  triggerKind: SpecialistRetirementTriggerKind;
  reason: string;
  evidenceRefs: string[];
  replacementSpecialistId?: string | null;
  fallbackTargetProfileId?: string | null;
  requestedAt: string;
};

export type RetireSpecialistResult =
  | {
      accepted: true;
      deduplicated: boolean;
      retirement: SpecialistRetirementDecisionRow;
    }
  | {
      accepted: false;
      reason: 'conflicting_request_id' | 'terminal_stage_conflict';
      retirement: SpecialistRetirementDecisionRow;
    };

export type SpecialistPolicyService = {
  admitSpecialist(input: SpecialistAdmissionInput): Promise<SpecialistAdmissionResult>;
  executeWithAdmittedSpecialist<T>(
    input: SpecialistAdmissionInput,
    execute: (decision: SpecialistAdmissionDecisionRow) => Promise<T>,
  ): Promise<SpecialistExecutionResult<T>>;
  retireSpecialist(input: RetireSpecialistInput): Promise<RetireSpecialistResult>;
};

type SpecialistPolicyServiceOptions = {
  store: SpecialistPolicyStore;
  evidence: SpecialistPolicyEvidencePorts;
  now?: SpecialistClock;
  createId?: () => string;
  deploymentIdentity?: string;
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const hashRecord = (value: Record<string, unknown>): string =>
  createHash('sha256').update(stableJson(value)).digest('hex');

const collectEvidenceRefs = (input: {
  organPromotionPackageRef?: string | null;
  admissionRefs: SpecialistAdmissionEvidenceRefs;
  policyRefs?: string[];
  extraRefs?: string[];
}): string[] =>
  [
    input.organPromotionPackageRef ?? null,
    input.admissionRefs.governorDecisionRef ?? null,
    input.admissionRefs.servingReadinessRef ?? null,
    input.admissionRefs.releaseEvidenceRef ?? null,
    input.admissionRefs.healthRef ?? null,
    input.admissionRefs.fallbackReadinessRef ?? null,
    ...(input.policyRefs ?? []),
    ...(input.extraRefs ?? []),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

const stale = (input: {
  observedAt: string | null | undefined;
  decisionAt: string;
  maxAgeMs: number | null;
}): boolean => {
  if (!input.maxAgeMs) {
    return false;
  }

  if (!input.observedAt) {
    return true;
  }

  const observed = Date.parse(input.observedAt);
  const decided = Date.parse(input.decisionAt);
  if (Number.isNaN(observed) || Number.isNaN(decided)) {
    return true;
  }

  return decided - observed > input.maxAgeMs;
};

const admissionRequestTimeOutsideWindow = (input: {
  requestedAt: string;
  decisionAt: string;
  maxSkewMs: number | null;
}): boolean => {
  const requested = Date.parse(input.requestedAt);
  const decided = Date.parse(input.decisionAt);
  if (Number.isNaN(requested) || Number.isNaN(decided)) {
    return true;
  }

  const maxSkewMs = input.maxSkewMs ?? 300_000;
  return Math.abs(decided - requested) > maxSkewMs;
};

const makeRefusal = (input: {
  reason: SpecialistRefusalReason;
  specialistId: string;
  taskSignature: string;
  fallbackTargetProfileId: string | null;
  evidenceRefs: string[];
  detail: string;
}): StructuredSpecialistRefusal => ({
  reason: input.reason,
  specialistId: input.specialistId,
  taskSignature: input.taskSignature,
  fallbackTargetProfileId: input.fallbackTargetProfileId,
  evidenceRefs: input.evidenceRefs,
  detail: input.detail,
});

const stageAllowsLiveAuthority = (stage: SpecialistRolloutStage): boolean =>
  isSpecialistLiveStage(stage);

const releaseEvidenceRequired = (policy: SpecialistRolloutPolicyRow): boolean =>
  stageAllowsLiveAuthority(policy.allowedStage) ||
  policy.requiredEvidenceClassesJson.includes(SPECIALIST_EVIDENCE_CLASS.RELEASE_EVIDENCE);

const specialistRefusalReasons = new Set<string>(Object.values(SPECIALIST_REFUSAL_REASON));

const persistenceFailureReason = (
  row: SpecialistAdmissionDecisionRow,
  fallback: SpecialistRefusalReason,
): SpecialistRefusalReason => {
  if (specialistRefusalReasons.has(row.reasonCode)) {
    return row.reasonCode as SpecialistRefusalReason;
  }

  return fallback;
};

export function createSpecialistPolicyService(
  options: SpecialistPolicyServiceOptions,
): SpecialistPolicyService {
  const now = options.now ?? (() => new Date().toISOString());
  const deploymentIdentity = options.deploymentIdentity ?? 'deployment-cell:local';
  let nextId = 1;
  const createId =
    options.createId ??
    (() => {
      const value = `specialist-policy:${nextId}`;
      nextId += 1;
      return value;
    });

  const persistAdmission = async (input: {
    admission: SpecialistAdmissionInput;
    policy: SpecialistRolloutPolicyRow | null;
    stage: SpecialistRolloutStage | null;
    selectedModelProfileId: string | null;
    decision: RecordSpecialistAdmissionDecisionInput['decision'];
    reasonCode: RecordSpecialistAdmissionDecisionInput['reasonCode'];
    fallbackTargetProfileId: string | null;
    evidenceRefs: string[];
    payloadJson: Record<string, unknown>;
    decisionAt: string;
  }): Promise<SpecialistRequestRecordResult<SpecialistAdmissionDecisionRow>> => {
    const normalizedRequestHash = hashRecord({
      specialistId: input.admission.specialistId,
      taskSignature: input.admission.taskSignature,
      selectedModelProfileId: input.selectedModelProfileId,
      stage: input.stage,
      decision: input.decision,
      reasonCode: input.reasonCode,
      fallbackTargetProfileId: input.fallbackTargetProfileId,
      evidenceRefs: input.evidenceRefs,
      payloadJson: input.payloadJson,
    });

    const result = await options.store.recordAdmissionDecision({
      decisionId: createId(),
      requestId: input.admission.requestId,
      normalizedRequestHash,
      specialistId: input.admission.specialistId,
      taskSignature: input.admission.taskSignature,
      selectedModelProfileId: input.selectedModelProfileId,
      stage: input.stage,
      decision: input.decision,
      reasonCode: input.reasonCode,
      fallbackTargetProfileId: input.fallbackTargetProfileId,
      evidenceRefsJson: input.evidenceRefs,
      payloadJson: {
        ...input.payloadJson,
        clientRequestedAt: input.admission.requestedAt,
        decisionAt: input.decisionAt,
        policyId: input.policy?.policyId ?? null,
      },
      createdAt: input.decisionAt,
    });

    return result;
  };

  const refuse = async (input: {
    admission: SpecialistAdmissionInput;
    policy: SpecialistRolloutPolicyRow | null;
    stage: SpecialistRolloutStage | null;
    selectedModelProfileId: string | null;
    fallbackTargetProfileId: string | null;
    reason: SpecialistRefusalReason;
    detail: string;
    evidenceRefs: string[];
    payloadJson?: Record<string, unknown>;
    decisionAt?: string;
  }): Promise<Extract<SpecialistAdmissionResult, { accepted: false }>> => {
    const decisionAt = input.decisionAt ?? now();
    const persisted = await persistAdmission({
      admission: input.admission,
      policy: input.policy,
      stage: input.stage,
      selectedModelProfileId: input.selectedModelProfileId,
      decision: SPECIALIST_ADMISSION_DECISION.REFUSAL,
      reasonCode: input.reason,
      fallbackTargetProfileId: input.fallbackTargetProfileId,
      evidenceRefs: input.evidenceRefs,
      payloadJson: input.payloadJson ?? {},
      decisionAt,
    });
    const conflictReason =
      !persisted.accepted && persisted.reason === 'conflicting_request_id'
        ? SPECIALIST_REFUSAL_REASON.CONFLICTING_REQUEST
        : input.reason;

    return {
      accepted: false,
      deduplicated: persisted.accepted ? persisted.deduplicated : false,
      decision: persisted.row,
      policy: input.policy,
      refusal: makeRefusal({
        reason: conflictReason,
        specialistId: input.admission.specialistId,
        taskSignature: input.admission.taskSignature,
        fallbackTargetProfileId: input.fallbackTargetProfileId,
        evidenceRefs: input.evidenceRefs,
        detail: input.detail,
      }),
    };
  };

  const admitSpecialist = async (
    input: SpecialistAdmissionInput,
  ): Promise<SpecialistAdmissionResult> => {
    const decisionAt = now();
    const organ = await options.store.getSpecialistOrgan(input.specialistId);
    const selectedModelProfileId = input.selectedModelProfileId ?? organ?.modelProfileId ?? null;
    const policy = organ
      ? await options.store.getCurrentRolloutPolicyForSpecialist(organ.specialistId)
      : null;
    const fallbackTargetProfileId =
      policy?.fallbackTargetProfileId ?? organ?.fallbackTargetProfileId ?? null;
    const baseEvidenceRefs = collectEvidenceRefs({
      organPromotionPackageRef: organ?.promotionPackageRef ?? null,
      admissionRefs: input.evidenceRefs,
      policyRefs: policy?.evidenceRefsJson ?? [],
    });

    if (!organ) {
      return await refuse({
        admission: input,
        policy,
        stage: null,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.ORGAN_NOT_FOUND,
        detail: `specialist ${input.specialistId} is not registered`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    if (!policy) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.POLICY_NOT_FOUND,
        detail: `specialist ${organ.specialistId} has no current rollout policy`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    if (
      admissionRequestTimeOutsideWindow({
        requestedAt: input.requestedAt,
        decisionAt,
        maxSkewMs: policy.healthMaxAgeMs,
      })
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
        detail: `specialist admission request time ${input.requestedAt} is outside the server decision window`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    if (organ.stage === SPECIALIST_ROLLOUT_STAGE.RETIRED) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.RETIRED,
        detail: `specialist ${organ.specialistId} is retired`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    if (
      input.taskSignature !== organ.taskSignature ||
      policy.governedScope !== organ.taskSignature ||
      selectedModelProfileId !== organ.modelProfileId
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.SCOPE_MISMATCH,
        detail: `specialist ${organ.specialistId} is not scoped to task ${input.taskSignature} and model ${selectedModelProfileId ?? 'null'}`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    if (organ.stage !== policy.allowedStage) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.UNSUPPORTED_STAGE,
        detail: `specialist current stage ${organ.stage} does not match policy stage ${policy.allowedStage}`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    if (!stageAllowsLiveAuthority(organ.stage)) {
      const reason =
        organ.stage === SPECIALIST_ROLLOUT_STAGE.SHADOW
          ? SPECIALIST_REFUSAL_REASON.SHADOW_NO_LIVE_AUTHORITY
          : SPECIALIST_REFUSAL_REASON.UNSUPPORTED_STAGE;
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason,
        detail: `specialist stage ${organ.stage} has no live decision authority`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    if (!organ.rollbackTargetProfileId) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.ROLLBACK_TARGET_MISSING,
        detail: `specialist ${organ.specialistId} has no rollback target`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }
    if (!fallbackTargetProfileId) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.ROLLBACK_TARGET_MISSING,
        detail: `specialist ${organ.specialistId} has no fallback target`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    const promotionPackage = await options.evidence.getWorkshopPromotionPackage({
      candidateId: organ.workshopCandidateId,
      promotionPackageRef: organ.promotionPackageRef,
    });
    if (!promotionPackage) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.WORKSHOP_EVIDENCE_MISSING,
        detail: `workshop promotion package ${organ.promotionPackageRef} is missing`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }
    if (
      promotionPackage.candidateKind !== WORKSHOP_CANDIDATE_KIND.SPECIALIST_CANDIDATE ||
      promotionPackage.candidateId !== organ.workshopCandidateId
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.WORKSHOP_CANDIDATE_INVALID,
        detail: `workshop package ${organ.promotionPackageRef} does not match specialist candidate ${organ.workshopCandidateId}`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    const governorDecisionRef = input.evidenceRefs.governorDecisionRef;
    const governor = governorDecisionRef
      ? await options.evidence.getGovernorDecision(governorDecisionRef)
      : null;
    if (!governor) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.GOVERNOR_EVIDENCE_MISSING,
        detail: 'specialist admission requires positive governor evidence',
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }
    if (!governor.approved) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.GOVERNOR_DENIED,
        detail: `governor decision ${governor.decisionRef} is not approved`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }
    if (
      governor.scope !== policy.governedScope ||
      stale({
        observedAt: governor.observedAt,
        decisionAt,
        maxAgeMs: policy.healthMaxAgeMs,
      })
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
        detail: `governor evidence ${governor.decisionRef} is stale or outside governed scope ${policy.governedScope}`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    const serving = await options.evidence.getServingDependencyState({
      serviceId: organ.serviceId,
      modelProfileId: organ.modelProfileId,
      artifactUri: promotionPackage.artifactUri,
      ...(input.evidenceRefs.servingReadinessRef
        ? { readinessRef: input.evidenceRefs.servingReadinessRef }
        : {}),
    });
    if (!serving) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.SERVING_READINESS_MISSING,
        detail: `serving readiness for ${organ.serviceId} is missing`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }
    if (
      serving.readiness !== 'ready' ||
      serving.artifactUri !== promotionPackage.artifactUri ||
      serving.candidateId !== promotionPackage.candidateId
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.SERVING_NOT_READY,
        detail: `serving dependency ${serving.serviceId} is not ready for candidate ${promotionPackage.candidateId}`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }
    if (
      stale({
        observedAt: serving.lastCheckedAt,
        decisionAt,
        maxAgeMs: policy.healthMaxAgeMs,
      })
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
        detail: `serving readiness for ${organ.serviceId} is stale`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    let release: SpecialistReleaseEvidence | null = null;
    if (releaseEvidenceRequired(policy)) {
      const releaseEvidenceRef = input.evidenceRefs.releaseEvidenceRef;
      release = releaseEvidenceRef
        ? await options.evidence.getReleaseEvidence(releaseEvidenceRef)
        : null;
      if (!release) {
        return await refuse({
          admission: input,
          policy,
          stage: organ.stage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.RELEASE_EVIDENCE_MISSING,
          detail: 'live specialist rollout requires release evidence',
          evidenceRefs: baseEvidenceRefs,
          decisionAt,
        });
      }
      if (!release.ready) {
        return await refuse({
          admission: input,
          policy,
          stage: organ.stage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.RELEASE_NOT_READY,
          detail: `release evidence ${release.evidenceRef} is not ready`,
          evidenceRefs: baseEvidenceRefs,
          decisionAt,
        });
      }
      if (
        release.modelServingReadinessRef !== input.evidenceRefs.servingReadinessRef ||
        release.governorEvidenceRef !== governorDecisionRef ||
        release.fallbackTargetProfileId !== fallbackTargetProfileId ||
        release.deploymentIdentity !== deploymentIdentity ||
        release.artifactUri !== promotionPackage.artifactUri ||
        release.artifactDescriptorPath !== serving.artifactDescriptorPath ||
        release.runtimeArtifactRoot !== serving.runtimeArtifactRoot ||
        release.specialistId !== organ.specialistId ||
        release.modelProfileId !== organ.modelProfileId ||
        release.serviceId !== organ.serviceId ||
        release.policyId !== policy.policyId ||
        release.rolloutStage !== organ.stage
      ) {
        return await refuse({
          admission: input,
          policy,
          stage: organ.stage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.RELEASE_NOT_READY,
          detail: `release evidence ${release.evidenceRef} is not bound to specialist ${organ.specialistId}`,
          evidenceRefs: baseEvidenceRefs,
          decisionAt,
        });
      }
      if (
        stale({
          observedAt: release.observedAt,
          decisionAt,
          maxAgeMs: policy.healthMaxAgeMs,
        })
      ) {
        return await refuse({
          admission: input,
          policy,
          stage: organ.stage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
          detail: `release evidence ${release.evidenceRef} is stale`,
          evidenceRefs: baseEvidenceRefs,
          decisionAt,
        });
      }
    }

    const health = await options.evidence.getHealthEvidence({
      modelProfileId: organ.modelProfileId,
      ...(input.evidenceRefs.healthRef ? { healthRef: input.evidenceRefs.healthRef } : {}),
    });
    if (!health) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.HEALTH_EVIDENCE_MISSING,
        detail: `health evidence for ${organ.modelProfileId} is missing`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }
    if (!health.healthy) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.SPECIALIST_UNHEALTHY,
        detail: health.detail ?? `specialist ${organ.modelProfileId} is unhealthy`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }
    if (
      stale({
        observedAt: health.observedAt,
        decisionAt,
        maxAgeMs: policy.healthMaxAgeMs,
      })
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: organ.stage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
        detail: `health evidence ${health.healthRef} is stale`,
        evidenceRefs: baseEvidenceRefs,
        decisionAt,
      });
    }

    if (fallbackTargetProfileId) {
      const fallback = await options.evidence.getFallbackReadiness({ fallbackTargetProfileId });
      if (!fallback?.available) {
        return await refuse({
          admission: input,
          policy,
          stage: organ.stage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.FALLBACK_UNAVAILABLE,
          detail: `declared fallback ${fallbackTargetProfileId} is unavailable`,
          evidenceRefs: baseEvidenceRefs,
          decisionAt,
        });
      }
      if (
        stale({
          observedAt: fallback.observedAt,
          decisionAt,
          maxAgeMs: policy.healthMaxAgeMs,
        })
      ) {
        return await refuse({
          admission: input,
          policy,
          stage: organ.stage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
          detail: `fallback readiness ${fallback.evidenceRef} is stale`,
          evidenceRefs: baseEvidenceRefs,
          decisionAt,
        });
      }
    }

    const evidenceRefs = collectEvidenceRefs({
      organPromotionPackageRef: organ.promotionPackageRef,
      admissionRefs: input.evidenceRefs,
      policyRefs: policy.evidenceRefsJson,
      extraRefs: [
        governor.decisionRef,
        serving.lastCheckedAt ? `serving:${serving.serviceId}:${serving.lastCheckedAt}` : '',
        release?.evidenceRef ?? '',
        release?.deploymentIdentity ?? '',
        health.healthRef,
        organ.rollbackTargetProfileId,
      ],
    });
    const persisted = await persistAdmission({
      admission: input,
      policy,
      stage: organ.stage,
      selectedModelProfileId: organ.modelProfileId,
      decision: SPECIALIST_ADMISSION_DECISION.ALLOW,
      reasonCode: 'admitted',
      fallbackTargetProfileId,
      evidenceRefs,
      payloadJson: {
        ...(input.payloadJson ?? {}),
        rolloutStage: organ.stage,
        trafficLimit: policy.trafficLimit,
        serviceId: organ.serviceId,
        governedScope: policy.governedScope,
        rollbackTargetProfileId: organ.rollbackTargetProfileId,
      },
      decisionAt,
    });
    if (!persisted.accepted || persisted.row.decision !== SPECIALIST_ADMISSION_DECISION.ALLOW) {
      const reason = !persisted.accepted
        ? persisted.reason === 'conflicting_request_id'
          ? SPECIALIST_REFUSAL_REASON.CONFLICTING_REQUEST
          : persistenceFailureReason(
              persisted.row,
              SPECIALIST_REFUSAL_REASON.TERMINAL_STAGE_CONFLICT,
            )
        : persistenceFailureReason(
            persisted.row,
            SPECIALIST_REFUSAL_REASON.TERMINAL_STAGE_CONFLICT,
          );
      return {
        accepted: false,
        deduplicated: persisted.accepted ? persisted.deduplicated : false,
        decision: persisted.row,
        policy,
        refusal: makeRefusal({
          reason,
          specialistId: input.specialistId,
          taskSignature: input.taskSignature,
          fallbackTargetProfileId,
          evidenceRefs,
          detail: `specialist admission was not durably accepted: ${persisted.row.reasonCode}`,
        }),
      };
    }

    return {
      accepted: true,
      deduplicated: persisted.deduplicated,
      decision: persisted.row,
      policy,
    };
  };

  return {
    admitSpecialist,

    async executeWithAdmittedSpecialist<T>(
      input: SpecialistAdmissionInput,
      execute: (decision: SpecialistAdmissionDecisionRow) => Promise<T>,
    ): Promise<SpecialistExecutionResult<T>> {
      const admission = await admitSpecialist(input);
      if (!admission.accepted) {
        return {
          accepted: false,
          specialistInvoked: false,
          admission,
        };
      }

      if (admission.deduplicated) {
        return {
          accepted: true,
          specialistInvoked: false,
          replayed: true,
          admission,
        };
      }

      const result = await execute(admission.decision);
      return {
        accepted: true,
        specialistInvoked: true,
        admission,
        result,
      };
    },

    async retireSpecialist(input: RetireSpecialistInput): Promise<RetireSpecialistResult> {
      const decisionAt = now();
      const organ = await options.store.getSpecialistOrgan(input.specialistId);
      if (!organ) {
        throw new Error(`specialist ${input.specialistId} is not registered`);
      }

      const normalizedRequestHash = hashRecord({
        specialistId: input.specialistId,
        triggerKind: input.triggerKind,
        reason: input.reason,
        evidenceRefs: input.evidenceRefs,
        replacementSpecialistId: input.replacementSpecialistId ?? null,
        fallbackTargetProfileId: input.fallbackTargetProfileId ?? organ.fallbackTargetProfileId,
      });

      const result = await options.store.recordRetirementDecision({
        retirementId: createId(),
        requestId: input.requestId,
        normalizedRequestHash,
        specialistId: input.specialistId,
        triggerKind: input.triggerKind,
        previousStage: organ.stage,
        replacementSpecialistId: input.replacementSpecialistId ?? null,
        fallbackTargetProfileId: input.fallbackTargetProfileId ?? organ.fallbackTargetProfileId,
        evidenceRefsJson: input.evidenceRefs,
        reason: input.reason,
        createdAt: decisionAt,
      });

      if (!result.accepted) {
        return {
          accepted: false,
          reason:
            result.reason === 'release_evidence_missing'
              ? 'terminal_stage_conflict'
              : result.reason,
          retirement: result.row,
        };
      }

      return {
        accepted: true,
        deduplicated: result.deduplicated,
        retirement: result.row,
      };
    },
  };
}
