export const WORKSHOP_DATASET_KIND = Object.freeze({
  SFT: 'sft',
  EVAL: 'eval',
  SPECIALIST: 'specialist',
} as const);

export type WorkshopDatasetKind =
  (typeof WORKSHOP_DATASET_KIND)[keyof typeof WORKSHOP_DATASET_KIND];

export const WORKSHOP_TRAINING_METHOD = Object.freeze({
  LORA: 'lora',
  QLORA: 'qlora',
  OTHER_BOUNDED_METHOD: 'other_bounded_method',
} as const);

export type WorkshopTrainingMethod =
  (typeof WORKSHOP_TRAINING_METHOD)[keyof typeof WORKSHOP_TRAINING_METHOD];

export const WORKSHOP_CANDIDATE_KIND = Object.freeze({
  SHARED_ADAPTER: 'shared_adapter',
  SPECIALIST_CANDIDATE: 'specialist_candidate',
} as const);

export type WorkshopCandidateKind =
  (typeof WORKSHOP_CANDIDATE_KIND)[keyof typeof WORKSHOP_CANDIDATE_KIND];

export const WORKSHOP_EVAL_SUBJECT_KIND = Object.freeze({
  ADAPTER_CANDIDATE: 'adapter_candidate',
  SPECIALIST_CANDIDATE: 'specialist_candidate',
} as const);

export type WorkshopEvalSubjectKind =
  (typeof WORKSHOP_EVAL_SUBJECT_KIND)[keyof typeof WORKSHOP_EVAL_SUBJECT_KIND];

export const WORKSHOP_CANDIDATE_STAGE = Object.freeze({
  CANDIDATE: 'candidate',
  SHADOW: 'shadow',
  LIMITED_ACTIVE: 'limited-active',
  ACTIVE: 'active',
  STABLE: 'stable',
  ROLLBACK: 'rollback',
} as const);

export type WorkshopCandidateStage =
  (typeof WORKSHOP_CANDIDATE_STAGE)[keyof typeof WORKSHOP_CANDIDATE_STAGE];

export const WORKSHOP_STAGE_TRIGGER_KIND = Object.freeze({
  WORKSHOP_EVAL_PASSED: 'workshop_eval_passed',
  APPROVAL_GRANTED: 'approval_granted',
  ACTIVATION_CONFIRMED: 'activation_confirmed',
  ROLLBACK_REQUESTED: 'rollback_requested',
} as const);

export type WorkshopStageTriggerKind =
  (typeof WORKSHOP_STAGE_TRIGGER_KIND)[keyof typeof WORKSHOP_STAGE_TRIGGER_KIND];

export const WORKSHOP_REQUESTED_BY_OWNER = Object.freeze({
  WORKSHOP: 'F-0015',
  GOVERNOR: 'CF-016',
  BASELINE_ROUTER: 'F-0008',
  EXPANDED_REGISTRY: 'F-0014',
  SPECIALIST_POLICY: 'CF-019',
  CONSOLIDATION: 'CF-018',
} as const);

export type WorkshopRequestedByOwner =
  (typeof WORKSHOP_REQUESTED_BY_OWNER)[keyof typeof WORKSHOP_REQUESTED_BY_OWNER];

export const WORKSHOP_JOB_KIND = Object.freeze({
  DATASET_BUILD: 'dataset_build',
  TRAINING_RUN: 'training_run',
  EVAL_RUN: 'eval_run',
  REGISTER_CANDIDATE: 'register_candidate',
  RECORD_STAGE_TRANSITION: 'record_stage_transition',
  PREPARE_PROMOTION_PACKAGE: 'prepare_promotion_package',
} as const);

export type WorkshopJobKind = (typeof WORKSHOP_JOB_KIND)[keyof typeof WORKSHOP_JOB_KIND];

export const WORKSHOP_JOB_QUEUE = Object.freeze({
  DATASET_BUILD: 'workshop.dataset-build',
  TRAINING_RUN: 'workshop.training-run',
  EVAL_RUN: 'workshop.eval-run',
  REGISTER_CANDIDATE: 'workshop.candidate-register',
  RECORD_STAGE_TRANSITION: 'workshop.candidate-transition',
  PREPARE_PROMOTION_PACKAGE: 'workshop.promotion-package',
} as const);

export type WorkshopDatasetBuildRequest = {
  requestId: string;
  datasetKind: WorkshopDatasetKind;
  sourceEpisodeIds: string[];
  sourceEvalRunIds: string[];
  redactionProfile: string;
};

export type WorkshopTrainingRequest = {
  requestId: string;
  targetKind: WorkshopCandidateKind;
  targetProfileId: string | null;
  datasetId: string;
  method: WorkshopTrainingMethod;
};

export type WorkshopEvalRequest = {
  requestId: string;
  subjectKind: WorkshopEvalSubjectKind;
  subjectRef: string;
  suiteName: string;
};

export type RegisterModelCandidateRequest = {
  requestId: string;
  candidateKind: WorkshopCandidateKind;
  targetProfileId: string | null;
  datasetId: string;
  trainingRunId: string;
  latestEvalRunId: string;
  artifactUri: string;
  predecessorProfileId: string | null;
  rollbackTarget: string | null;
  requiredEvalSuite: string;
  lastKnownGoodEvalReportUri: string | null;
};

export type RecordCandidateStageTransitionRequest = {
  requestId: string;
  candidateId: string;
  toStage: WorkshopCandidateStage;
  triggerKind: WorkshopStageTriggerKind;
  evidenceRefs: string[];
  requestedByOwner: WorkshopRequestedByOwner;
};

export type PrepareWorkshopPromotionPackageRequest = {
  requestId: string;
  candidateId: string;
};

export type WorkshopPromotionPackage = {
  candidateId: string;
  candidateStage: Exclude<WorkshopCandidateStage, 'candidate'>;
  candidateKind: WorkshopCandidateKind;
  targetProfileId: string | null;
  predecessorProfileId: string | null;
  rollbackTarget: string | null;
  requiredEvalSuite: string;
  lastKnownGoodEvalReportUri: string | null;
  artifactUri: string;
};

export type WorkshopJobPayloadMap = {
  [WORKSHOP_JOB_KIND.DATASET_BUILD]: WorkshopDatasetBuildRequest;
  [WORKSHOP_JOB_KIND.TRAINING_RUN]: WorkshopTrainingRequest;
  [WORKSHOP_JOB_KIND.EVAL_RUN]: WorkshopEvalRequest;
  [WORKSHOP_JOB_KIND.REGISTER_CANDIDATE]: RegisterModelCandidateRequest;
  [WORKSHOP_JOB_KIND.RECORD_STAGE_TRANSITION]: RecordCandidateStageTransitionRequest;
  [WORKSHOP_JOB_KIND.PREPARE_PROMOTION_PACKAGE]: PrepareWorkshopPromotionPackageRequest;
};

export type WorkshopJobEnvelope<TKind extends WorkshopJobKind = WorkshopJobKind> = {
  jobKind: TKind;
  requestId: string;
  requestedAt: string;
  payload: WorkshopJobPayloadMap[TKind];
};

const FORBIDDEN_DATASET_REDACTION_PROFILES = new Set(['raw', 'none', 'unreviewed']);

export const isSafeDatasetRedactionProfile = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !FORBIDDEN_DATASET_REDACTION_PROFILES.has(normalized);
};

export const assertValidDatasetBuildRequest = (input: WorkshopDatasetBuildRequest): void => {
  if (input.sourceEpisodeIds.length === 0 && input.sourceEvalRunIds.length === 0) {
    throw new Error('workshop dataset build requires bounded episode or eval sources');
  }

  if (!isSafeDatasetRedactionProfile(input.redactionProfile)) {
    throw new Error(
      `workshop dataset build requires a reviewed redaction profile, received ${JSON.stringify(input.redactionProfile)}`,
    );
  }
};

export const assertValidWorkshopJobEnvelope = <TKind extends WorkshopJobKind>(
  envelope: WorkshopJobEnvelope<TKind>,
): void => {
  if (envelope.requestId.trim().length === 0) {
    throw new Error('workshop job envelope requires requestId');
  }

  if (envelope.requestedAt.trim().length === 0) {
    throw new Error('workshop job envelope requires requestedAt');
  }

  if (envelope.jobKind === WORKSHOP_JOB_KIND.DATASET_BUILD) {
    assertValidDatasetBuildRequest(
      envelope.payload as WorkshopJobPayloadMap[typeof WORKSHOP_JOB_KIND.DATASET_BUILD],
    );
  }
};

export const createWorkshopJobEnvelope = <TKind extends WorkshopJobKind>(input: {
  jobKind: TKind;
  requestId: string;
  requestedAt: string;
  payload: WorkshopJobPayloadMap[TKind];
}): WorkshopJobEnvelope<TKind> => {
  const envelope: WorkshopJobEnvelope<TKind> = {
    jobKind: input.jobKind,
    requestId: input.requestId,
    requestedAt: input.requestedAt,
    payload: input.payload,
  };

  assertValidWorkshopJobEnvelope(envelope);
  return envelope;
};
