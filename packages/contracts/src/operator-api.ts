import { z } from 'zod';
import {
  DEVELOPMENT_GOVERNOR_EVIDENCE_REF_MAX_COUNT,
  DEVELOPMENT_GOVERNOR_PROBLEM_SIGNATURE_MAX_LENGTH,
  DEVELOPMENT_GOVERNOR_REASON_MAX_LENGTH,
  DEVELOPMENT_GOVERNOR_REF_MAX_LENGTH,
  DEVELOPMENT_GOVERNOR_REQUEST_ID_MAX_LENGTH,
  DEVELOPMENT_GOVERNOR_SUMMARY_MAX_LENGTH,
  developmentGovernorEvidenceRefSchema,
  developmentProposalKindSchema,
} from './governor.ts';
import {
  RELEASE_EVIDENCE_REF_MAX_COUNT,
  RELEASE_REF_MAX_LENGTH,
  releaseTargetEnvironmentSchema,
} from './release-automation.ts';
import { TICK_KIND } from './runtime.ts';

const isoTimestampSchema = z.string().datetime({ offset: true });
const jsonRecordSchema = z.record(z.string(), z.unknown());

export const OPERATOR_STATE_MAX_GOAL_LIMIT = 100;
export const OPERATOR_STATE_MAX_BELIEF_LIMIT = 100;
export const OPERATOR_STATE_MAX_ENTITY_LIMIT = 100;
export const OPERATOR_STATE_MAX_RELATIONSHIP_LIMIT = 200;
export const OPERATOR_HISTORY_DEFAULT_LIMIT = 20;
export const OPERATOR_HISTORY_MAX_LIMIT = 100;
export const OPERATOR_TICK_REQUEST_ID_MAX_LENGTH = DEVELOPMENT_GOVERNOR_REQUEST_ID_MAX_LENGTH;
export const OPERATOR_TICK_NOTE_MAX_LENGTH = 500;
export const OPERATOR_TICK_PAYLOAD_MAX_BYTES = 8192;
export const OPERATOR_TICK_BODY_MAX_BYTES = 12_000;
export const OPERATOR_GOVERNOR_CONTROL_BODY_MAX_BYTES = 64_000;
export const OPERATOR_RELEASE_CONTROL_BODY_MAX_BYTES = 64_000;

const boundedInt = (max: number) => z.coerce.number().int().positive().max(max);

const boundedJsonRecord = (maxBytes: number) =>
  jsonRecordSchema.superRefine((value, context) => {
    const byteLength = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (byteLength > maxBytes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `JSON payload must be at most ${maxBytes} bytes`,
      });
    }
  });

export const operatorStateQuerySchema = z.object({
  goalLimit: boundedInt(OPERATOR_STATE_MAX_GOAL_LIMIT).default(25),
  beliefLimit: boundedInt(OPERATOR_STATE_MAX_BELIEF_LIMIT).default(25),
  entityLimit: boundedInt(OPERATOR_STATE_MAX_ENTITY_LIMIT).default(25),
  relationshipLimit: boundedInt(OPERATOR_STATE_MAX_RELATIONSHIP_LIMIT).default(50),
});

export type OperatorStateQuery = z.infer<typeof operatorStateQuerySchema>;

export const operatorTimelineCursorSchema = z.object({
  occurredAt: isoTimestampSchema,
  sequenceId: z.string().regex(/^\d+$/),
});

export type OperatorTimelineCursor = z.infer<typeof operatorTimelineCursorSchema>;

export const operatorTimelineQuerySchema = z.object({
  limit: boundedInt(OPERATOR_HISTORY_MAX_LIMIT).default(OPERATOR_HISTORY_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
});

export type OperatorTimelineQuery = z.infer<typeof operatorTimelineQuerySchema>;

export const operatorEpisodeCursorSchema = z.object({
  createdAt: isoTimestampSchema,
  episodeId: z.string().min(1),
});

export type OperatorEpisodeCursor = z.infer<typeof operatorEpisodeCursorSchema>;

export const operatorEpisodesQuerySchema = z.object({
  limit: boundedInt(OPERATOR_HISTORY_MAX_LIMIT).default(OPERATOR_HISTORY_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
});

export type OperatorEpisodesQuery = z.infer<typeof operatorEpisodesQuerySchema>;

export const operatorTickControlKindSchema = z.enum([
  TICK_KIND.REACTIVE,
  TICK_KIND.DELIBERATIVE,
  TICK_KIND.CONTEMPLATIVE,
  TICK_KIND.CONSOLIDATION,
  TICK_KIND.DEVELOPMENTAL,
]);

export const operatorTickControlRequestSchema = z.object({
  requestId: z.string().min(1).max(OPERATOR_TICK_REQUEST_ID_MAX_LENGTH),
  kind: operatorTickControlKindSchema,
  note: z.string().min(1).max(OPERATOR_TICK_NOTE_MAX_LENGTH).optional(),
  payload: boundedJsonRecord(OPERATOR_TICK_PAYLOAD_MAX_BYTES).default({}),
});

export type OperatorTickControlRequest = z.infer<typeof operatorTickControlRequestSchema>;

export const operatorFreezeDevelopmentRequestSchema = z.object({
  requestId: z.string().min(1).max(DEVELOPMENT_GOVERNOR_REQUEST_ID_MAX_LENGTH),
  reason: z.string().min(1).max(DEVELOPMENT_GOVERNOR_REASON_MAX_LENGTH),
  evidenceRefs: z
    .array(developmentGovernorEvidenceRefSchema)
    .max(DEVELOPMENT_GOVERNOR_EVIDENCE_REF_MAX_COUNT)
    .default([]),
});

export type OperatorFreezeDevelopmentRequest = z.infer<
  typeof operatorFreezeDevelopmentRequestSchema
>;

export const operatorDevelopmentProposalRequestSchema = z.object({
  requestId: z.string().min(1).max(DEVELOPMENT_GOVERNOR_REQUEST_ID_MAX_LENGTH),
  proposalKind: developmentProposalKindSchema,
  problemSignature: z.string().min(1).max(DEVELOPMENT_GOVERNOR_PROBLEM_SIGNATURE_MAX_LENGTH),
  summary: z.string().min(1).max(DEVELOPMENT_GOVERNOR_SUMMARY_MAX_LENGTH),
  evidenceRefs: z
    .array(developmentGovernorEvidenceRefSchema)
    .max(DEVELOPMENT_GOVERNOR_EVIDENCE_REF_MAX_COUNT)
    .default([]),
  rollbackPlanRef: z
    .string()
    .min(1)
    .max(DEVELOPMENT_GOVERNOR_REF_MAX_LENGTH)
    .nullable()
    .default(null),
  targetRef: z.string().min(1).max(DEVELOPMENT_GOVERNOR_REF_MAX_LENGTH).nullable().default(null),
});

export type OperatorDevelopmentProposalRequest = z.infer<
  typeof operatorDevelopmentProposalRequestSchema
>;

const releaseRefSchema = z.string().min(1).max(RELEASE_REF_MAX_LENGTH);
const releaseEvidenceRefsSchema = z
  .array(releaseRefSchema)
  .max(RELEASE_EVIDENCE_REF_MAX_COUNT)
  .default([]);

export const operatorReleaseInspectionQuerySchema = z
  .object({
    requestId: releaseRefSchema,
  })
  .strict();

export type OperatorReleaseInspectionQuery = z.infer<typeof operatorReleaseInspectionQuerySchema>;

export const operatorReleasePrepareRequestSchema = z
  .object({
    requestId: releaseRefSchema,
    targetEnvironment: releaseTargetEnvironmentSchema,
    gitRef: releaseRefSchema,
    rollbackTargetRef: releaseRefSchema,
    governorEvidenceRef: releaseRefSchema,
    lifecycleRollbackTargetRef: releaseRefSchema,
    modelServingReadinessRef: releaseRefSchema,
    diagnosticReportRefs: releaseEvidenceRefsSchema.refine((refs) => refs.length > 0, {
      message: 'At least one diagnostic report ref is required',
    }),
    evidenceRefs: releaseEvidenceRefsSchema,
  })
  .strict();

export type OperatorReleasePrepareRequest = z.infer<typeof operatorReleasePrepareRequestSchema>;

export const operatorReleaseDeployAttemptRequestSchema = z
  .object({
    requestId: releaseRefSchema,
    deployAttemptId: releaseRefSchema.optional(),
    deploymentIdentity: releaseRefSchema.optional(),
    migrationState: releaseRefSchema.optional(),
  })
  .strict();

export type OperatorReleaseDeployAttemptRequest = z.infer<
  typeof operatorReleaseDeployAttemptRequestSchema
>;

export const operatorReleaseRollbackRequestSchema = z
  .object({
    requestId: releaseRefSchema,
    deployAttemptId: releaseRefSchema,
    rollbackPlanId: releaseRefSchema.optional(),
  })
  .strict();

export type OperatorReleaseRollbackRequest = z.infer<typeof operatorReleaseRollbackRequestSchema>;
