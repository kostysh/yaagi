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
import type { RecordSpecialistAdmissionDecisionInput, SpecialistPolicyStore } from '@yaagi/db';

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
  currentTrafficCount?: number;
  evidenceRefs: SpecialistAdmissionEvidenceRefs;
  payloadJson?: Record<string, unknown>;
};

export type SpecialistAdmissionResult =
  | {
      accepted: true;
      decision: SpecialistAdmissionDecisionRow;
      policy: SpecialistRolloutPolicyRow;
    }
  | {
      accepted: false;
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
  requestedAt: string;
  maxAgeMs: number | null;
}): boolean => {
  if (!input.maxAgeMs) {
    return false;
  }

  if (!input.observedAt) {
    return true;
  }

  const observed = Date.parse(input.observedAt);
  const requested = Date.parse(input.requestedAt);
  if (Number.isNaN(observed) || Number.isNaN(requested)) {
    return true;
  }

  return requested - observed > input.maxAgeMs;
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

export function createSpecialistPolicyService(
  options: SpecialistPolicyServiceOptions,
): SpecialistPolicyService {
  const now = options.now ?? (() => new Date().toISOString());
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
  }): Promise<SpecialistAdmissionDecisionRow> => {
    const createdAt = now();
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
        requestedAt: input.admission.requestedAt,
        policyId: input.policy?.policyId ?? null,
      },
      createdAt,
    });

    return result.row;
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
  }): Promise<Extract<SpecialistAdmissionResult, { accepted: false }>> => {
    const decision = await persistAdmission({
      admission: input.admission,
      policy: input.policy,
      stage: input.stage,
      selectedModelProfileId: input.selectedModelProfileId,
      decision: SPECIALIST_ADMISSION_DECISION.REFUSAL,
      reasonCode: input.reason,
      fallbackTargetProfileId: input.fallbackTargetProfileId,
      evidenceRefs: input.evidenceRefs,
      payloadJson: input.payloadJson ?? {},
    });

    return {
      accepted: false,
      decision,
      policy: input.policy,
      refusal: makeRefusal({
        reason: input.reason,
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
      });
    }

    if (!stageAllowsLiveAuthority(policy.allowedStage)) {
      const reason =
        policy.allowedStage === SPECIALIST_ROLLOUT_STAGE.SHADOW
          ? SPECIALIST_REFUSAL_REASON.SHADOW_NO_LIVE_AUTHORITY
          : SPECIALIST_REFUSAL_REASON.UNSUPPORTED_STAGE;
      return await refuse({
        admission: input,
        policy,
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason,
        detail: `specialist stage ${policy.allowedStage} has no live decision authority`,
        evidenceRefs: baseEvidenceRefs,
      });
    }

    if (!organ.rollbackTargetProfileId) {
      return await refuse({
        admission: input,
        policy,
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.ROLLBACK_TARGET_MISSING,
        detail: `specialist ${organ.specialistId} has no rollback target`,
        evidenceRefs: baseEvidenceRefs,
      });
    }

    if (
      policy.allowedStage === SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE &&
      policy.trafficLimit !== null &&
      (input.currentTrafficCount ?? 0) >= policy.trafficLimit
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.TRAFFIC_LIMIT_EXCEEDED,
        detail: `specialist ${organ.specialistId} exceeded limited-active traffic limit ${policy.trafficLimit}`,
        evidenceRefs: baseEvidenceRefs,
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
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.WORKSHOP_EVIDENCE_MISSING,
        detail: `workshop promotion package ${organ.promotionPackageRef} is missing`,
        evidenceRefs: baseEvidenceRefs,
      });
    }
    if (
      promotionPackage.candidateKind !== WORKSHOP_CANDIDATE_KIND.SPECIALIST_CANDIDATE ||
      promotionPackage.candidateId !== organ.workshopCandidateId
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.WORKSHOP_CANDIDATE_INVALID,
        detail: `workshop package ${organ.promotionPackageRef} does not match specialist candidate ${organ.workshopCandidateId}`,
        evidenceRefs: baseEvidenceRefs,
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
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.GOVERNOR_EVIDENCE_MISSING,
        detail: 'specialist admission requires positive governor evidence',
        evidenceRefs: baseEvidenceRefs,
      });
    }
    if (!governor.approved) {
      return await refuse({
        admission: input,
        policy,
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.GOVERNOR_DENIED,
        detail: `governor decision ${governor.decisionRef} is not approved`,
        evidenceRefs: baseEvidenceRefs,
      });
    }
    if (
      governor.scope !== policy.governedScope ||
      stale({
        observedAt: governor.observedAt,
        requestedAt: input.requestedAt,
        maxAgeMs: policy.healthMaxAgeMs,
      })
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
        detail: `governor evidence ${governor.decisionRef} is stale or outside governed scope ${policy.governedScope}`,
        evidenceRefs: baseEvidenceRefs,
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
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.SERVING_READINESS_MISSING,
        detail: `serving readiness for ${organ.serviceId} is missing`,
        evidenceRefs: baseEvidenceRefs,
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
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.SERVING_NOT_READY,
        detail: `serving dependency ${serving.serviceId} is not ready for candidate ${promotionPackage.candidateId}`,
        evidenceRefs: baseEvidenceRefs,
      });
    }
    if (
      stale({
        observedAt: serving.lastCheckedAt,
        requestedAt: input.requestedAt,
        maxAgeMs: policy.healthMaxAgeMs,
      })
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
        detail: `serving readiness for ${organ.serviceId} is stale`,
        evidenceRefs: baseEvidenceRefs,
      });
    }

    if (releaseEvidenceRequired(policy)) {
      const releaseEvidenceRef = input.evidenceRefs.releaseEvidenceRef;
      const release = releaseEvidenceRef
        ? await options.evidence.getReleaseEvidence(releaseEvidenceRef)
        : null;
      if (!release) {
        return await refuse({
          admission: input,
          policy,
          stage: policy.allowedStage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.RELEASE_EVIDENCE_MISSING,
          detail: 'live specialist rollout requires release evidence',
          evidenceRefs: baseEvidenceRefs,
        });
      }
      if (!release.ready) {
        return await refuse({
          admission: input,
          policy,
          stage: policy.allowedStage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.RELEASE_NOT_READY,
          detail: `release evidence ${release.evidenceRef} is not ready`,
          evidenceRefs: baseEvidenceRefs,
        });
      }
      if (
        stale({
          observedAt: release.observedAt,
          requestedAt: input.requestedAt,
          maxAgeMs: policy.healthMaxAgeMs,
        })
      ) {
        return await refuse({
          admission: input,
          policy,
          stage: policy.allowedStage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
          detail: `release evidence ${release.evidenceRef} is stale`,
          evidenceRefs: baseEvidenceRefs,
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
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.HEALTH_EVIDENCE_MISSING,
        detail: `health evidence for ${organ.modelProfileId} is missing`,
        evidenceRefs: baseEvidenceRefs,
      });
    }
    if (!health.healthy) {
      return await refuse({
        admission: input,
        policy,
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.SPECIALIST_UNHEALTHY,
        detail: health.detail ?? `specialist ${organ.modelProfileId} is unhealthy`,
        evidenceRefs: baseEvidenceRefs,
      });
    }
    if (
      stale({
        observedAt: health.observedAt,
        requestedAt: input.requestedAt,
        maxAgeMs: policy.healthMaxAgeMs,
      })
    ) {
      return await refuse({
        admission: input,
        policy,
        stage: policy.allowedStage,
        selectedModelProfileId,
        fallbackTargetProfileId,
        reason: SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE,
        detail: `health evidence ${health.healthRef} is stale`,
        evidenceRefs: baseEvidenceRefs,
      });
    }

    if (fallbackTargetProfileId) {
      const fallback = await options.evidence.getFallbackReadiness({ fallbackTargetProfileId });
      if (!fallback?.available) {
        return await refuse({
          admission: input,
          policy,
          stage: policy.allowedStage,
          selectedModelProfileId,
          fallbackTargetProfileId,
          reason: SPECIALIST_REFUSAL_REASON.FALLBACK_UNAVAILABLE,
          detail: `declared fallback ${fallbackTargetProfileId} is unavailable`,
          evidenceRefs: baseEvidenceRefs,
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
        health.healthRef,
        organ.rollbackTargetProfileId,
      ],
    });
    const decision = await persistAdmission({
      admission: input,
      policy,
      stage: policy.allowedStage,
      selectedModelProfileId: organ.modelProfileId,
      decision: SPECIALIST_ADMISSION_DECISION.ALLOW,
      reasonCode: 'admitted',
      fallbackTargetProfileId,
      evidenceRefs,
      payloadJson: {
        ...(input.payloadJson ?? {}),
        rolloutStage: policy.allowedStage,
        currentTrafficCount: input.currentTrafficCount ?? 0,
        rollbackTargetProfileId: organ.rollbackTargetProfileId,
      },
    });

    return {
      accepted: true,
      decision,
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

      const result = await execute(admission.decision);
      return {
        accepted: true,
        specialistInvoked: true,
        admission,
        result,
      };
    },

    async retireSpecialist(input: RetireSpecialistInput): Promise<RetireSpecialistResult> {
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
        createdAt: input.requestedAt,
      });

      if (!result.accepted) {
        return {
          accepted: false,
          reason: result.reason,
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
