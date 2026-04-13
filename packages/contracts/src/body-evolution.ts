import { z } from 'zod';

export const BODY_CHANGE_REQUEST_ID_MAX_LENGTH = 200;
export const BODY_CHANGE_REF_MAX_LENGTH = 500;
export const BODY_CHANGE_REASON_MAX_LENGTH = 2_000;
export const BODY_CHANGE_PATH_MAX_LENGTH = 1_000;
export const BODY_CHANGE_PATH_MAX_COUNT = 100;
export const BODY_CHANGE_EVIDENCE_REF_MAX_LENGTH = 500;
export const BODY_CHANGE_EVIDENCE_REF_MAX_COUNT = 100;

export const BODY_CHANGE_REQUESTED_BY_OWNER = Object.freeze({
  GOVERNOR: 'governor',
  HUMAN_OVERRIDE: 'human_override',
} as const);

export type BodyChangeRequestedByOwner =
  (typeof BODY_CHANGE_REQUESTED_BY_OWNER)[keyof typeof BODY_CHANGE_REQUESTED_BY_OWNER];

export const BODY_CHANGE_SCOPE_KIND = Object.freeze({
  CODE: 'code',
  CONFIG: 'config',
  BODY_MANIFEST: 'body_manifest',
} as const);

export type BodyChangeScopeKind =
  (typeof BODY_CHANGE_SCOPE_KIND)[keyof typeof BODY_CHANGE_SCOPE_KIND];

export const BODY_CHANGE_STATUS = Object.freeze({
  REQUESTED: 'requested',
  WORKTREE_READY: 'worktree_ready',
  EVALUATING: 'evaluating',
  EVALUATION_FAILED: 'evaluation_failed',
  CANDIDATE_COMMITTED: 'candidate_committed',
  SNAPSHOT_READY: 'snapshot_ready',
  ROLLED_BACK: 'rolled_back',
  REJECTED: 'rejected',
} as const);

export type BodyChangeStatus = (typeof BODY_CHANGE_STATUS)[keyof typeof BODY_CHANGE_STATUS];

export const BODY_CHANGE_EVENT_KIND = Object.freeze({
  PROPOSAL_RECORDED: 'proposal_recorded',
  BOUNDARY_CHECKED: 'boundary_checked',
  WORKTREE_PREPARED: 'worktree_prepared',
  EVALUATION_STARTED: 'evaluation_started',
  EVALUATION_FAILED: 'evaluation_failed',
  CANDIDATE_COMMITTED: 'candidate_committed',
  STABLE_SNAPSHOT_PUBLISHED: 'stable_snapshot_published',
  ROLLBACK_EVIDENCE_RECORDED: 'rollback_evidence_recorded',
} as const);

export type BodyChangeEventKind =
  (typeof BODY_CHANGE_EVENT_KIND)[keyof typeof BODY_CHANGE_EVENT_KIND];

export const BODY_CHANGE_GATE_KIND = Object.freeze({
  REPO: 'repo',
  EVAL: 'eval',
  SMOKE: 'smoke',
} as const);

export type BodyChangeGateKind = (typeof BODY_CHANGE_GATE_KIND)[keyof typeof BODY_CHANGE_GATE_KIND];

export const bodyChangeRequestedByOwnerSchema = z.enum([
  BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
  BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE,
]);

export const bodyChangeScopeKindSchema = z.enum([
  BODY_CHANGE_SCOPE_KIND.CODE,
  BODY_CHANGE_SCOPE_KIND.CONFIG,
  BODY_CHANGE_SCOPE_KIND.BODY_MANIFEST,
]);

export const bodyChangeStatusSchema = z.enum([
  BODY_CHANGE_STATUS.REQUESTED,
  BODY_CHANGE_STATUS.WORKTREE_READY,
  BODY_CHANGE_STATUS.EVALUATING,
  BODY_CHANGE_STATUS.EVALUATION_FAILED,
  BODY_CHANGE_STATUS.CANDIDATE_COMMITTED,
  BODY_CHANGE_STATUS.SNAPSHOT_READY,
  BODY_CHANGE_STATUS.ROLLED_BACK,
  BODY_CHANGE_STATUS.REJECTED,
]);

export const bodyChangeEventKindSchema = z.enum([
  BODY_CHANGE_EVENT_KIND.PROPOSAL_RECORDED,
  BODY_CHANGE_EVENT_KIND.BOUNDARY_CHECKED,
  BODY_CHANGE_EVENT_KIND.WORKTREE_PREPARED,
  BODY_CHANGE_EVENT_KIND.EVALUATION_STARTED,
  BODY_CHANGE_EVENT_KIND.EVALUATION_FAILED,
  BODY_CHANGE_EVENT_KIND.CANDIDATE_COMMITTED,
  BODY_CHANGE_EVENT_KIND.STABLE_SNAPSHOT_PUBLISHED,
  BODY_CHANGE_EVENT_KIND.ROLLBACK_EVIDENCE_RECORDED,
]);

export const bodyChangeGateKindSchema = z.enum([
  BODY_CHANGE_GATE_KIND.REPO,
  BODY_CHANGE_GATE_KIND.EVAL,
  BODY_CHANGE_GATE_KIND.SMOKE,
]);

export const bodyChangeEvidenceRefSchema = z
  .string()
  .min(1)
  .max(BODY_CHANGE_EVIDENCE_REF_MAX_LENGTH);

export const bodyChangeTargetPathSchema = z.string().min(1).max(BODY_CHANGE_PATH_MAX_LENGTH);

const bodyChangeGovernorAuthoritySchema = z.object({
  requestedByOwner: z.literal(BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR),
  governorProposalId: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  governorDecisionRef: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  ownerOverrideEvidenceRef: z.never().optional(),
});

const bodyChangeHumanOverrideAuthoritySchema = z.object({
  requestedByOwner: z.literal(BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE),
  ownerOverrideEvidenceRef: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  governorProposalId: z.never().optional(),
  governorDecisionRef: z.never().optional(),
});

export const bodyChangeAuthoritySchema = z.discriminatedUnion('requestedByOwner', [
  bodyChangeGovernorAuthoritySchema,
  bodyChangeHumanOverrideAuthoritySchema,
]);

export type BodyChangeAuthority = z.infer<typeof bodyChangeAuthoritySchema>;

export const bodyChangeRequestSchema = bodyChangeAuthoritySchema.and(
  z.object({
    requestId: z.string().min(1).max(BODY_CHANGE_REQUEST_ID_MAX_LENGTH),
    scopeKind: bodyChangeScopeKindSchema,
    rationale: z.string().min(1).max(BODY_CHANGE_REASON_MAX_LENGTH),
    requiredEvalSuite: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
    targetPaths: z.array(bodyChangeTargetPathSchema).min(1).max(BODY_CHANGE_PATH_MAX_COUNT),
    rollbackPlanRef: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
    evidenceRefs: z
      .array(bodyChangeEvidenceRefSchema)
      .min(1)
      .max(BODY_CHANGE_EVIDENCE_REF_MAX_COUNT),
  }),
);

export type BodyChangeRequest = z.infer<typeof bodyChangeRequestSchema>;

export const bodyChangeProposalSchema = z.object({
  proposalId: z.string().min(1),
  requestId: z.string().min(1).max(BODY_CHANGE_REQUEST_ID_MAX_LENGTH),
  normalizedRequestHash: z.string().min(1),
  requestedByOwner: bodyChangeRequestedByOwnerSchema,
  governorProposalId: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH).nullable(),
  governorDecisionRef: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH).nullable(),
  ownerOverrideEvidenceRef: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH).nullable(),
  branchName: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  worktreePath: z.string().min(1).max(BODY_CHANGE_PATH_MAX_LENGTH),
  candidateCommitSha: z.string().min(1).nullable(),
  stableSnapshotId: z.string().min(1).nullable(),
  status: bodyChangeStatusSchema,
  scopeKind: bodyChangeScopeKindSchema,
  requiredEvalSuite: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  targetPaths: z.array(bodyChangeTargetPathSchema).min(1).max(BODY_CHANGE_PATH_MAX_COUNT),
  rollbackPlanRef: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  evidenceRefs: z.array(bodyChangeEvidenceRefSchema).min(1).max(BODY_CHANGE_EVIDENCE_REF_MAX_COUNT),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type BodyChangeProposal = z.infer<typeof bodyChangeProposalSchema>;

export const bodyChangeEventSchema = z.object({
  eventId: z.string().min(1),
  proposalId: z.string().min(1),
  eventKind: bodyChangeEventKindSchema,
  status: bodyChangeStatusSchema,
  evidenceRefs: z.array(bodyChangeEvidenceRefSchema).min(1).max(BODY_CHANGE_EVIDENCE_REF_MAX_COUNT),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime({ offset: true }),
});

export type BodyChangeEvent = z.infer<typeof bodyChangeEventSchema>;

export const bodyChangeGateCheckSchema = z.object({
  kind: bodyChangeGateKindSchema,
  label: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  ok: z.boolean(),
  evidenceRef: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH).nullable(),
  detail: z.string().min(1).max(BODY_CHANGE_REASON_MAX_LENGTH).nullable(),
});

export type BodyChangeGateCheck = z.infer<typeof bodyChangeGateCheckSchema>;

export const bodyStableSnapshotSchema = z.object({
  snapshotId: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  proposalId: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  gitTag: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  schemaVersion: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  modelProfileMapJson: z.record(z.string(), z.string()),
  criticalConfigHash: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  evalSummaryJson: z.record(z.string(), z.unknown()),
  manifestHash: z.string().min(1).max(BODY_CHANGE_REF_MAX_LENGTH),
  manifestPath: z.string().min(1).max(BODY_CHANGE_PATH_MAX_LENGTH),
  createdAt: z.string().datetime({ offset: true }),
});

export type BodyStableSnapshot = z.infer<typeof bodyStableSnapshotSchema>;

export const bodyChangeProposalAcceptedSchema = z.object({
  accepted: z.literal(true),
  requestId: z.string().min(1).max(BODY_CHANGE_REQUEST_ID_MAX_LENGTH),
  proposalId: z.string().min(1),
  status: bodyChangeStatusSchema,
  deduplicated: z.boolean(),
  proposal: bodyChangeProposalSchema,
  createdAt: z.string().datetime({ offset: true }),
});

export const bodyChangeProposalRejectedSchema = z.object({
  accepted: z.literal(false),
  requestId: z.string().min(1).max(BODY_CHANGE_REQUEST_ID_MAX_LENGTH).optional(),
  reason: z.enum([
    'invalid_request',
    'governor_not_approved',
    'override_not_recorded',
    'request_hash_conflict',
    'seed_write_rejected',
    'worktree_escape_rejected',
    'persistence_unavailable',
  ]),
  detail: z.string().min(1).optional(),
});

export const bodyChangeProposalResultSchema = z.discriminatedUnion('accepted', [
  bodyChangeProposalAcceptedSchema,
  bodyChangeProposalRejectedSchema,
]);

export type BodyChangeProposalResult = z.infer<typeof bodyChangeProposalResultSchema>;
