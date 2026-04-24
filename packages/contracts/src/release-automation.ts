import { z } from 'zod';

export const RELEASE_AUTOMATION_SCHEMA_VERSION = '2026-04-24.release-automation.v1';

export const RELEASE_REF_MAX_LENGTH = 240;
export const RELEASE_EVIDENCE_REF_MAX_COUNT = 64;
export const RELEASE_FILE_ARTIFACT_REF_MAX_COUNT = 64;

const isoTimestampSchema = z.string().datetime({ offset: true });
const nullableIsoTimestampSchema = isoTimestampSchema.nullable().default(null);
const boundedRefSchema = z.string().min(1).max(RELEASE_REF_MAX_LENGTH);
const evidenceRefsSchema = z
  .array(boundedRefSchema)
  .max(RELEASE_EVIDENCE_REF_MAX_COUNT)
  .default([]);
const jsonRecordSchema = z.record(z.string(), z.unknown());

export const RELEASE_TARGET_ENVIRONMENT = Object.freeze({
  LOCAL: 'local',
  RELEASE_CELL: 'release_cell',
} as const);

export type ReleaseTargetEnvironment =
  (typeof RELEASE_TARGET_ENVIRONMENT)[keyof typeof RELEASE_TARGET_ENVIRONMENT];

export const RELEASE_REQUEST_SOURCE = Object.freeze({
  CLI: 'cli',
  OPERATOR_API: 'operator_api',
  CI: 'ci',
} as const);

export type ReleaseRequestSource =
  (typeof RELEASE_REQUEST_SOURCE)[keyof typeof RELEASE_REQUEST_SOURCE];

export const RELEASE_REQUESTED_ACTION = Object.freeze({
  DEPLOY: 'deploy',
  ROLLBACK: 'rollback',
} as const);

export type ReleaseRequestedAction =
  (typeof RELEASE_REQUESTED_ACTION)[keyof typeof RELEASE_REQUESTED_ACTION];

export const DEPLOY_ATTEMPT_STATUS = Object.freeze({
  PREPARED: 'prepared',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  SMOKE_FAILED: 'smoke_failed',
  ROLLED_BACK: 'rolled_back',
  FAILED: 'failed',
} as const);

export type DeployAttemptStatus =
  (typeof DEPLOY_ATTEMPT_STATUS)[keyof typeof DEPLOY_ATTEMPT_STATUS];

export const RELEASE_SMOKE_STATUS = Object.freeze({
  PASSED: 'passed',
  FAILED: 'failed',
  UNAVAILABLE: 'unavailable',
} as const);

export type ReleaseSmokeStatus = (typeof RELEASE_SMOKE_STATUS)[keyof typeof RELEASE_SMOKE_STATUS];

export const ROLLBACK_PLAN_PREFLIGHT_STATUS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
} as const);

export type RollbackPlanPreflightStatus =
  (typeof ROLLBACK_PLAN_PREFLIGHT_STATUS)[keyof typeof ROLLBACK_PLAN_PREFLIGHT_STATUS];

export const ROLLBACK_EXECUTION_MODE = Object.freeze({
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
} as const);

export type RollbackExecutionMode =
  (typeof ROLLBACK_EXECUTION_MODE)[keyof typeof ROLLBACK_EXECUTION_MODE];

export const ROLLBACK_EXECUTION_TRIGGER = Object.freeze({
  AUTO_SMOKE_FAILURE: 'auto_smoke_failure',
  OPERATOR_MANUAL: 'operator_manual',
  CI_MANUAL: 'ci_manual',
} as const);

export type RollbackExecutionTrigger =
  (typeof ROLLBACK_EXECUTION_TRIGGER)[keyof typeof ROLLBACK_EXECUTION_TRIGGER];

export const ROLLBACK_EXECUTION_STATUS = Object.freeze({
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CRITICAL_FAILURE: 'critical_failure',
} as const);

export type RollbackExecutionStatus =
  (typeof ROLLBACK_EXECUTION_STATUS)[keyof typeof ROLLBACK_EXECUTION_STATUS];

export const RELEASE_AUTOMATION_REJECTION_REASON = Object.freeze({
  IDEMPOTENCY_CONFLICT: 'idempotency_conflict',
  FOREIGN_OWNER_WRITE_REJECTED: 'foreign_owner_write_rejected',
  RESERVED_EVIDENCE_REF_REJECTED: 'reserved_evidence_ref_rejected',
  MISSING_ROLLBACK_PLAN: 'missing_rollback_plan',
  EVIDENCE_STORAGE_UNAVAILABLE: 'evidence_storage_unavailable',
  DIAGNOSTIC_REPORT_UNAVAILABLE: 'diagnostic_report_unavailable',
  GOVERNOR_EVIDENCE_MISSING: 'governor_evidence_missing',
  LIFECYCLE_ROLLBACK_TARGET_MISSING: 'lifecycle_rollback_target_missing',
  MODEL_READINESS_UNAVAILABLE: 'model_readiness_unavailable',
  SMOKE_HARNESS_UNAVAILABLE: 'smoke_harness_unavailable',
  RELEASE_REQUEST_MISSING: 'release_request_missing',
  ROLLBACK_EXECUTOR_UNAVAILABLE: 'rollback_executor_unavailable',
} as const);

export type ReleaseAutomationRejectionReason =
  (typeof RELEASE_AUTOMATION_REJECTION_REASON)[keyof typeof RELEASE_AUTOMATION_REJECTION_REASON];

export const RELEASE_AUTOMATION_OWNED_WRITE_SURFACE = Object.freeze({
  RELEASE_REQUESTS: 'polyphony_runtime.release_requests',
  DEPLOY_ATTEMPTS: 'polyphony_runtime.deploy_attempts',
  RELEASE_EVIDENCE: 'polyphony_runtime.release_evidence',
  ROLLBACK_PLANS: 'polyphony_runtime.rollback_plans',
  ROLLBACK_EXECUTIONS: 'polyphony_runtime.rollback_executions',
} as const);

export type ReleaseAutomationOwnedWriteSurface =
  (typeof RELEASE_AUTOMATION_OWNED_WRITE_SURFACE)[keyof typeof RELEASE_AUTOMATION_OWNED_WRITE_SURFACE];

export const RELEASE_AUTOMATION_FOREIGN_WRITE_SURFACE = Object.freeze({
  GOVERNOR_DECISIONS: 'polyphony_runtime.development_proposal_decisions',
  LIFECYCLE_EVENTS: 'polyphony_runtime.lifecycle_events',
  LIFECYCLE_ROLLBACK_INCIDENTS: 'polyphony_runtime.rollback_incidents',
  REPORT_RUNS: 'polyphony_runtime.report_runs',
  MODEL_PROFILE_HEALTH: 'polyphony_runtime.model_profile_health',
  SMOKE_HARNESS_STATE: 'infra.docker.deployment_cell_smoke',
} as const);

export type ReleaseAutomationForeignWriteSurface =
  (typeof RELEASE_AUTOMATION_FOREIGN_WRITE_SURFACE)[keyof typeof RELEASE_AUTOMATION_FOREIGN_WRITE_SURFACE];

const releaseTargetEnvironmentValues = [
  RELEASE_TARGET_ENVIRONMENT.LOCAL,
  RELEASE_TARGET_ENVIRONMENT.RELEASE_CELL,
] as const;

const releaseRequestSourceValues = [
  RELEASE_REQUEST_SOURCE.CLI,
  RELEASE_REQUEST_SOURCE.OPERATOR_API,
  RELEASE_REQUEST_SOURCE.CI,
] as const;

const releaseRequestedActionValues = [
  RELEASE_REQUESTED_ACTION.DEPLOY,
  RELEASE_REQUESTED_ACTION.ROLLBACK,
] as const;

const deployAttemptStatusValues = [
  DEPLOY_ATTEMPT_STATUS.PREPARED,
  DEPLOY_ATTEMPT_STATUS.RUNNING,
  DEPLOY_ATTEMPT_STATUS.SUCCEEDED,
  DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED,
  DEPLOY_ATTEMPT_STATUS.ROLLED_BACK,
  DEPLOY_ATTEMPT_STATUS.FAILED,
] as const;

const releaseSmokeStatusValues = [
  RELEASE_SMOKE_STATUS.PASSED,
  RELEASE_SMOKE_STATUS.FAILED,
  RELEASE_SMOKE_STATUS.UNAVAILABLE,
] as const;

const rollbackPlanPreflightStatusValues = [
  ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
  ROLLBACK_PLAN_PREFLIGHT_STATUS.BLOCKED,
] as const;

const rollbackExecutionModeValues = [
  ROLLBACK_EXECUTION_MODE.AUTOMATIC,
  ROLLBACK_EXECUTION_MODE.MANUAL,
] as const;

const rollbackExecutionTriggerValues = [
  ROLLBACK_EXECUTION_TRIGGER.AUTO_SMOKE_FAILURE,
  ROLLBACK_EXECUTION_TRIGGER.OPERATOR_MANUAL,
  ROLLBACK_EXECUTION_TRIGGER.CI_MANUAL,
] as const;

const rollbackExecutionStatusValues = [
  ROLLBACK_EXECUTION_STATUS.RUNNING,
  ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
  ROLLBACK_EXECUTION_STATUS.FAILED,
  ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE,
] as const;

export const releaseTargetEnvironmentSchema = z.enum(releaseTargetEnvironmentValues);
export const releaseRequestSourceSchema = z.enum(releaseRequestSourceValues);
export const releaseRequestedActionSchema = z.enum(releaseRequestedActionValues);
export const deployAttemptStatusSchema = z.enum(deployAttemptStatusValues);
export const releaseSmokeStatusSchema = z.enum(releaseSmokeStatusValues);
export const rollbackPlanPreflightStatusSchema = z.enum(rollbackPlanPreflightStatusValues);
export const rollbackExecutionModeSchema = z.enum(rollbackExecutionModeValues);
export const rollbackExecutionTriggerSchema = z.enum(rollbackExecutionTriggerValues);
export const rollbackExecutionStatusSchema = z.enum(rollbackExecutionStatusValues);

export const releaseRequestSchema = z
  .object({
    requestId: boundedRefSchema,
    targetEnvironment: releaseTargetEnvironmentSchema,
    gitRef: boundedRefSchema,
    rollbackTargetRef: boundedRefSchema,
    actorRef: boundedRefSchema,
    source: releaseRequestSourceSchema,
    requestedAction: releaseRequestedActionSchema.default(RELEASE_REQUESTED_ACTION.DEPLOY),
    evidenceRefs: evidenceRefsSchema,
    requestedAt: isoTimestampSchema,
  })
  .strict();

export type ReleaseRequest = z.infer<typeof releaseRequestSchema>;

export const releaseRequestRowSchema = releaseRequestSchema.extend({
  normalizedRequestHash: boundedRefSchema,
  createdAt: isoTimestampSchema,
});

export type ReleaseRequestRow = z.infer<typeof releaseRequestRowSchema>;

export const rollbackPlanSchema = z
  .object({
    rollbackPlanId: boundedRefSchema,
    releaseRequestId: boundedRefSchema,
    deployAttemptId: boundedRefSchema.nullable().default(null),
    rollbackTargetRef: boundedRefSchema,
    requiredEvidenceRefs: evidenceRefsSchema,
    executionMode: rollbackExecutionModeSchema,
    preflightStatus: rollbackPlanPreflightStatusSchema,
    createdAt: isoTimestampSchema,
  })
  .strict();

export type RollbackPlan = z.infer<typeof rollbackPlanSchema>;

export const deployAttemptSchema = z
  .object({
    deployAttemptId: boundedRefSchema,
    releaseRequestId: boundedRefSchema,
    rollbackPlanId: boundedRefSchema,
    targetEnvironment: releaseTargetEnvironmentSchema,
    deploymentIdentity: boundedRefSchema,
    migrationState: boundedRefSchema,
    status: deployAttemptStatusSchema,
    failureReason: z.string().min(1).max(RELEASE_REF_MAX_LENGTH).nullable().default(null),
    startedAt: nullableIsoTimestampSchema,
    finishedAt: nullableIsoTimestampSchema,
    createdAt: isoTimestampSchema,
  })
  .strict();

export type DeployAttempt = z.infer<typeof deployAttemptSchema>;

export const releaseSmokeResultSchema = z
  .object({
    status: releaseSmokeStatusSchema,
    command: z.string().min(1).max(RELEASE_REF_MAX_LENGTH),
    startedAt: isoTimestampSchema,
    finishedAt: isoTimestampSchema,
    exitCode: z.number().int().nullable().default(null),
    evidenceRef: boundedRefSchema.nullable().default(null),
  })
  .strict();

export type ReleaseSmokeResult = z.infer<typeof releaseSmokeResultSchema>;

export const releaseEvidenceBundleSchema = z
  .object({
    evidenceBundleId: boundedRefSchema,
    releaseRequestId: boundedRefSchema,
    deployAttemptId: boundedRefSchema,
    commitRef: boundedRefSchema,
    deploymentIdentity: boundedRefSchema,
    migrationState: boundedRefSchema,
    smokeOnDeployResult: releaseSmokeResultSchema,
    modelServingReadinessRef: boundedRefSchema,
    governorEvidenceRef: boundedRefSchema,
    lifecycleRollbackTargetRef: boundedRefSchema,
    diagnosticReportRefs: evidenceRefsSchema,
    fileArtifactRefs: z
      .array(boundedRefSchema)
      .max(RELEASE_FILE_ARTIFACT_REF_MAX_COUNT)
      .default([]),
    materializedAt: isoTimestampSchema,
  })
  .strict();

export type ReleaseEvidenceBundle = z.infer<typeof releaseEvidenceBundleSchema>;

export const rollbackExecutionSchema = z
  .object({
    rollbackExecutionId: boundedRefSchema,
    rollbackPlanId: boundedRefSchema,
    deployAttemptId: boundedRefSchema,
    trigger: rollbackExecutionTriggerSchema,
    status: rollbackExecutionStatusSchema,
    evidenceRefs: evidenceRefsSchema,
    diagnosticReportRefs: evidenceRefsSchema,
    executedAt: isoTimestampSchema,
    failureReason: z.string().min(1).max(RELEASE_REF_MAX_LENGTH).nullable().default(null),
  })
  .strict();

export type RollbackExecution = z.infer<typeof rollbackExecutionSchema>;

export const releaseInspectionSchema = z
  .object({
    request: releaseRequestRowSchema,
    rollbackPlan: rollbackPlanSchema.nullable(),
    deployAttempts: z.array(deployAttemptSchema),
    evidenceBundles: z.array(releaseEvidenceBundleSchema),
    rollbackExecutions: z.array(rollbackExecutionSchema),
  })
  .strict();

export type ReleaseInspection = z.infer<typeof releaseInspectionSchema>;

const ownedWriteSurfaces = new Set<string>(Object.values(RELEASE_AUTOMATION_OWNED_WRITE_SURFACE));

export const isReleaseAutomationOwnedWriteSurface = (
  value: string,
): value is ReleaseAutomationOwnedWriteSurface => ownedWriteSurfaces.has(value);

export const assertReleaseAutomationOwnedWriteSurface = (surface: string): void => {
  if (!isReleaseAutomationOwnedWriteSurface(surface)) {
    throw new Error(
      `${RELEASE_AUTOMATION_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED}: ${surface}`,
    );
  }
};

export const assertValidReleaseRequest = (request: ReleaseRequest): void => {
  releaseRequestSchema.parse(request);
};

export const assertValidRollbackPlan = (plan: RollbackPlan): void => {
  rollbackPlanSchema.parse(plan);
};

export const assertValidDeployAttempt = (attempt: DeployAttempt): void => {
  deployAttemptSchema.parse(attempt);
};

export const assertValidReleaseEvidenceBundle = (bundle: ReleaseEvidenceBundle): void => {
  releaseEvidenceBundleSchema.parse(bundle);
};

export const assertValidRollbackExecution = (execution: RollbackExecution): void => {
  rollbackExecutionSchema.parse(execution);
};

export const boundedReleaseJsonRecord = (maxBytes: number) =>
  jsonRecordSchema.superRefine((value, context) => {
    const byteLength = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (byteLength > maxBytes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `JSON payload must be at most ${maxBytes} bytes`,
      });
    }
  });
