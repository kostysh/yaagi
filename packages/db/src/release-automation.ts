import { createHash } from 'node:crypto';
import type { Client, QueryResultRow } from 'pg';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_AUTOMATION_REJECTION_REASON,
  RELEASE_AUTOMATION_OWNED_WRITE_SURFACE,
  RELEASE_REQUESTED_ACTION,
  ROLLBACK_EXECUTION_MODE,
  ROLLBACK_PLAN_PREFLIGHT_STATUS,
  assertReleaseAutomationOwnedWriteSurface,
  releaseEvidenceBundleSchema,
  releaseRequestRowSchema,
  releaseRequestSchema,
  rollbackExecutionSchema,
  rollbackPlanSchema,
  deployAttemptSchema,
  type DeployAttempt,
  type DeployAttemptStatus,
  type ReleaseAutomationRejectionReason,
  type ReleaseEvidenceBundle,
  type ReleaseInspection,
  type ReleaseRequest,
  type ReleaseRequestRow,
  type RollbackExecution,
  type RollbackExecutionMode,
  type RollbackPlan,
} from '@yaagi/contracts/release-automation';
import { RUNTIME_SCHEMA } from './runtime.ts';

export type ReleaseAutomationDbExecutor = Pick<Client, 'query'>;

export type CreateReleaseRequestInput = ReleaseRequest;

export type CreateReleaseRequestResult =
  | {
      accepted: true;
      deduplicated: boolean;
      request: ReleaseRequestRow;
    }
  | {
      accepted: false;
      reason: typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
      existingRequest: ReleaseRequestRow;
    };

export type CreateRollbackPlanInput = {
  rollbackPlanId: string;
  releaseRequestId: string;
  deployAttemptId?: string | null;
  rollbackTargetRef: string;
  requiredEvidenceRefs: string[];
  executionMode?: RollbackExecutionMode;
  preflightStatus?: RollbackPlan['preflightStatus'];
  createdAt: string;
};

export type CreateRollbackPlanResult =
  | {
      accepted: true;
      deduplicated: boolean;
      plan: RollbackPlan;
    }
  | {
      accepted: false;
      reason:
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
    };

export type StartDeployAttemptInput = {
  deployAttemptId: string;
  releaseRequestId: string;
  rollbackPlanId: string;
  targetEnvironment: DeployAttempt['targetEnvironment'];
  deploymentIdentity: string;
  migrationState: string;
  evidenceStorageWritable: boolean;
  startedAt: string;
};

export type StartDeployAttemptResult =
  | {
      accepted: true;
      deduplicated: boolean;
      attempt: DeployAttempt;
    }
  | {
      accepted: false;
      reason:
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.EVIDENCE_STORAGE_UNAVAILABLE
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
    };

export type CompleteDeployAttemptInput = {
  deployAttemptId: string;
  status: DeployAttemptStatus;
  failureReason?: string | null;
  finishedAt: string;
};

export type RecordReleaseEvidenceInput = ReleaseEvidenceBundle;

export type RecordReleaseEvidenceResult =
  | {
      accepted: true;
      deduplicated: boolean;
      bundle: ReleaseEvidenceBundle;
    }
  | {
      accepted: false;
      reason: typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
      existingBundle: ReleaseEvidenceBundle;
    };

export type RecordRollbackExecutionInput = RollbackExecution;

export type RecordRollbackExecutionResult =
  | {
      accepted: true;
      deduplicated: boolean;
      execution: RollbackExecution;
    }
  | {
      accepted: false;
      reason: typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
      existingExecution: RollbackExecution;
    };

export type CompleteRollbackExecutionInput = RollbackExecution;

export type CompleteRollbackExecutionResult = RecordRollbackExecutionResult;

export type ReleaseAutomationStore = {
  assertOwnedWriteSurface(surface: string): void;
  createReleaseRequest(input: CreateReleaseRequestInput): Promise<CreateReleaseRequestResult>;
  getReleaseRequest(requestId: string): Promise<ReleaseRequestRow | null>;
  createRollbackPlan(input: CreateRollbackPlanInput): Promise<CreateRollbackPlanResult>;
  getRollbackPlan(rollbackPlanId: string): Promise<RollbackPlan | null>;
  getRollbackPlanForRequest(releaseRequestId: string): Promise<RollbackPlan | null>;
  startDeployAttempt(input: StartDeployAttemptInput): Promise<StartDeployAttemptResult>;
  completeDeployAttempt(input: CompleteDeployAttemptInput): Promise<DeployAttempt | null>;
  recordReleaseEvidence(input: RecordReleaseEvidenceInput): Promise<RecordReleaseEvidenceResult>;
  recordRollbackExecution(
    input: RecordRollbackExecutionInput,
  ): Promise<RecordRollbackExecutionResult>;
  completeRollbackExecution(
    input: CompleteRollbackExecutionInput,
  ): Promise<CompleteRollbackExecutionResult>;
  getRollbackExecution(rollbackExecutionId: string): Promise<RollbackExecution | null>;
  inspectReleaseRequest(requestId: string): Promise<ReleaseInspection | null>;
};

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;
const releaseRequestsTable = runtimeSchemaTable('release_requests');
const rollbackPlansTable = runtimeSchemaTable('rollback_plans');
const deployAttemptsTable = runtimeSchemaTable('deploy_attempts');
const releaseEvidenceTable = runtimeSchemaTable('release_evidence');
const rollbackExecutionsTable = runtimeSchemaTable('rollback_executions');

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const releaseRequestColumns = `
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  target_environment as "targetEnvironment",
  git_ref as "gitRef",
  rollback_target_ref as "rollbackTargetRef",
  actor_ref as "actorRef",
  source,
  requested_action as "requestedAction",
  evidence_refs_json as "evidenceRefs",
  ${asUtcIso('requested_at', 'requestedAt')},
  ${asUtcIso('created_at', 'createdAt')}
`;

const rollbackPlanColumns = `
  rollback_plan_id as "rollbackPlanId",
  release_request_id as "releaseRequestId",
  deploy_attempt_id as "deployAttemptId",
  rollback_target_ref as "rollbackTargetRef",
  required_evidence_refs_json as "requiredEvidenceRefs",
  execution_mode as "executionMode",
  preflight_status as "preflightStatus",
  ${asUtcIso('created_at', 'createdAt')}
`;

const deployAttemptColumns = `
  deploy_attempt_id as "deployAttemptId",
  release_request_id as "releaseRequestId",
  rollback_plan_id as "rollbackPlanId",
  target_environment as "targetEnvironment",
  deployment_identity as "deploymentIdentity",
  migration_state as "migrationState",
  status,
  failure_reason as "failureReason",
  ${asUtcIso('started_at', 'startedAt')},
  ${asUtcIso('finished_at', 'finishedAt')},
  ${asUtcIso('created_at', 'createdAt')}
`;

const releaseEvidenceColumns = `
  evidence_bundle_id as "evidenceBundleId",
  release_request_id as "releaseRequestId",
  deploy_attempt_id as "deployAttemptId",
  commit_ref as "commitRef",
  deployment_identity as "deploymentIdentity",
  migration_state as "migrationState",
  smoke_on_deploy_result_json as "smokeOnDeployResult",
  model_serving_readiness_ref as "modelServingReadinessRef",
  governor_evidence_ref as "governorEvidenceRef",
  lifecycle_rollback_target_ref as "lifecycleRollbackTargetRef",
  diagnostic_report_refs_json as "diagnosticReportRefs",
  file_artifact_refs_json as "fileArtifactRefs",
  ${asUtcIso('materialized_at', 'materializedAt')}
`;

const rollbackExecutionColumns = `
  rollback_execution_id as "rollbackExecutionId",
  rollback_plan_id as "rollbackPlanId",
  deploy_attempt_id as "deployAttemptId",
  trigger,
  status,
  evidence_refs_json as "evidenceRefs",
  diagnostic_report_refs_json as "diagnosticReportRefs",
  ${asUtcIso('executed_at', 'executedAt')},
  failure_reason as "failureReason"
`;

const rollbackExecutionColumnsForAlias = (alias: string): string => `
  ${alias}.rollback_execution_id as "rollbackExecutionId",
  ${alias}.rollback_plan_id as "rollbackPlanId",
  ${alias}.deploy_attempt_id as "deployAttemptId",
  ${alias}.trigger,
  ${alias}.status,
  ${alias}.evidence_refs_json as "evidenceRefs",
  ${alias}.diagnostic_report_refs_json as "diagnosticReportRefs",
  ${asUtcIso(`${alias}.executed_at`, 'executedAt')},
  ${alias}.failure_reason as "failureReason"
`;

const normalizeTimestamp = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`release automation row field ${field} must be a string or Date timestamp`);
};

const normalizeNullableTimestamp = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeTimestamp(value, field);
};

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value === null || value === undefined ? fallback : (value as T);
};

const rowValue = (row: QueryResultRow, key: string): unknown => row[key] as unknown;

const normalizeStringArray = (value: unknown): string[] => {
  const parsed = parseJson<unknown[]>(value, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return Array.from(
    new Set(
      parsed
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ).sort();
};

const normalizeRequestRow = (row: QueryResultRow): ReleaseRequestRow =>
  releaseRequestRowSchema.parse({
    requestId: String(rowValue(row, 'requestId')),
    targetEnvironment: rowValue(row, 'targetEnvironment'),
    gitRef: String(rowValue(row, 'gitRef')),
    rollbackTargetRef: String(rowValue(row, 'rollbackTargetRef')),
    actorRef: String(rowValue(row, 'actorRef')),
    source: rowValue(row, 'source'),
    requestedAction: rowValue(row, 'requestedAction') ?? RELEASE_REQUESTED_ACTION.DEPLOY,
    evidenceRefs: normalizeStringArray(rowValue(row, 'evidenceRefs')),
    requestedAt: normalizeTimestamp(rowValue(row, 'requestedAt'), 'release_requests.requestedAt'),
    normalizedRequestHash: String(rowValue(row, 'normalizedRequestHash')),
    createdAt: normalizeTimestamp(rowValue(row, 'createdAt'), 'release_requests.createdAt'),
  });

const normalizeRollbackPlanRow = (row: QueryResultRow): RollbackPlan =>
  rollbackPlanSchema.parse({
    rollbackPlanId: String(rowValue(row, 'rollbackPlanId')),
    releaseRequestId: String(rowValue(row, 'releaseRequestId')),
    deployAttemptId:
      typeof rowValue(row, 'deployAttemptId') === 'string'
        ? String(rowValue(row, 'deployAttemptId'))
        : null,
    rollbackTargetRef: String(rowValue(row, 'rollbackTargetRef')),
    requiredEvidenceRefs: normalizeStringArray(rowValue(row, 'requiredEvidenceRefs')),
    executionMode: rowValue(row, 'executionMode'),
    preflightStatus: rowValue(row, 'preflightStatus'),
    createdAt: normalizeTimestamp(rowValue(row, 'createdAt'), 'rollback_plans.createdAt'),
  });

const normalizeDeployAttemptRow = (row: QueryResultRow): DeployAttempt =>
  deployAttemptSchema.parse({
    deployAttemptId: String(rowValue(row, 'deployAttemptId')),
    releaseRequestId: String(rowValue(row, 'releaseRequestId')),
    rollbackPlanId: String(rowValue(row, 'rollbackPlanId')),
    targetEnvironment: rowValue(row, 'targetEnvironment'),
    deploymentIdentity: String(rowValue(row, 'deploymentIdentity')),
    migrationState: String(rowValue(row, 'migrationState')),
    status: rowValue(row, 'status'),
    failureReason:
      typeof rowValue(row, 'failureReason') === 'string'
        ? String(rowValue(row, 'failureReason'))
        : null,
    startedAt: normalizeNullableTimestamp(rowValue(row, 'startedAt'), 'deploy_attempts.startedAt'),
    finishedAt: normalizeNullableTimestamp(
      rowValue(row, 'finishedAt'),
      'deploy_attempts.finishedAt',
    ),
    createdAt: normalizeTimestamp(rowValue(row, 'createdAt'), 'deploy_attempts.createdAt'),
  });

const normalizeReleaseEvidenceRow = (row: QueryResultRow): ReleaseEvidenceBundle =>
  releaseEvidenceBundleSchema.parse({
    evidenceBundleId: String(rowValue(row, 'evidenceBundleId')),
    releaseRequestId: String(rowValue(row, 'releaseRequestId')),
    deployAttemptId: String(rowValue(row, 'deployAttemptId')),
    commitRef: String(rowValue(row, 'commitRef')),
    deploymentIdentity: String(rowValue(row, 'deploymentIdentity')),
    migrationState: String(rowValue(row, 'migrationState')),
    smokeOnDeployResult: parseJson(rowValue(row, 'smokeOnDeployResult'), {}),
    modelServingReadinessRef: String(rowValue(row, 'modelServingReadinessRef')),
    governorEvidenceRef: String(rowValue(row, 'governorEvidenceRef')),
    lifecycleRollbackTargetRef: String(rowValue(row, 'lifecycleRollbackTargetRef')),
    diagnosticReportRefs: normalizeStringArray(rowValue(row, 'diagnosticReportRefs')),
    fileArtifactRefs: normalizeStringArray(rowValue(row, 'fileArtifactRefs')),
    materializedAt: normalizeTimestamp(
      rowValue(row, 'materializedAt'),
      'release_evidence.materializedAt',
    ),
  });

const normalizeRollbackExecutionRow = (row: QueryResultRow): RollbackExecution =>
  rollbackExecutionSchema.parse({
    rollbackExecutionId: String(rowValue(row, 'rollbackExecutionId')),
    rollbackPlanId: String(rowValue(row, 'rollbackPlanId')),
    deployAttemptId: String(rowValue(row, 'deployAttemptId')),
    trigger: rowValue(row, 'trigger'),
    status: rowValue(row, 'status'),
    evidenceRefs: normalizeStringArray(rowValue(row, 'evidenceRefs')),
    diagnosticReportRefs: normalizeStringArray(rowValue(row, 'diagnosticReportRefs')),
    executedAt: normalizeTimestamp(rowValue(row, 'executedAt'), 'rollback_executions.executedAt'),
    failureReason:
      typeof rowValue(row, 'failureReason') === 'string'
        ? String(rowValue(row, 'failureReason'))
        : null,
  });

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }

  return value;
};

const hashRequest = (input: ReleaseRequest): string =>
  createHash('sha256')
    .update(
      JSON.stringify(
        stableValue({
          targetEnvironment: input.targetEnvironment,
          gitRef: input.gitRef,
          rollbackTargetRef: input.rollbackTargetRef,
          actorRef: input.actorRef,
          source: input.source,
          requestedAction: input.requestedAction,
          evidenceRefs: hashStableReleaseEvidenceRefs(input.evidenceRefs),
        }),
      ),
    )
    .digest('hex');

const OPERATOR_AUTH_EVIDENCE_REF_PREFIX = 'operator-auth-evidence:';

const hashStableReleaseEvidenceRefs = (evidenceRefs: readonly string[]): string[] =>
  evidenceRefs.filter((ref) => !ref.startsWith(OPERATOR_AUTH_EVIDENCE_REF_PREFIX)).sort();

const sortedStrings = (values: readonly string[]): string[] => [...values].sort();

const equalStringSet = (left: readonly string[], right: readonly string[]): boolean => {
  const sortedLeft = sortedStrings(left);
  const sortedRight = sortedStrings(right);
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
};

const equivalentReleaseEvidenceBundle = (
  existing: ReleaseEvidenceBundle,
  input: ReleaseEvidenceBundle,
): boolean =>
  existing.releaseRequestId === input.releaseRequestId &&
  existing.deployAttemptId === input.deployAttemptId &&
  existing.commitRef === input.commitRef &&
  existing.deploymentIdentity === input.deploymentIdentity &&
  existing.migrationState === input.migrationState &&
  JSON.stringify(stableValue(existing.smokeOnDeployResult)) ===
    JSON.stringify(stableValue(input.smokeOnDeployResult)) &&
  existing.modelServingReadinessRef === input.modelServingReadinessRef &&
  existing.governorEvidenceRef === input.governorEvidenceRef &&
  existing.lifecycleRollbackTargetRef === input.lifecycleRollbackTargetRef &&
  equalStringSet(existing.diagnosticReportRefs, input.diagnosticReportRefs) &&
  equalStringSet(existing.fileArtifactRefs, input.fileArtifactRefs) &&
  existing.materializedAt === input.materializedAt;

const equivalentRollbackExecution = (
  existing: RollbackExecution,
  input: RollbackExecution,
): boolean =>
  existing.rollbackPlanId === input.rollbackPlanId &&
  existing.deployAttemptId === input.deployAttemptId &&
  existing.trigger === input.trigger &&
  existing.status === input.status &&
  equalStringSet(existing.evidenceRefs, input.evidenceRefs) &&
  equalStringSet(existing.diagnosticReportRefs, input.diagnosticReportRefs) &&
  existing.executedAt === input.executedAt &&
  existing.failureReason === input.failureReason;

const equivalentRollbackPlan = (
  existing: RollbackPlan,
  input: CreateRollbackPlanInput,
): boolean => {
  const expectedRequiredEvidenceRefs = [...input.requiredEvidenceRefs].sort();
  return (
    existing.releaseRequestId === input.releaseRequestId &&
    existing.deployAttemptId === (input.deployAttemptId ?? null) &&
    existing.rollbackTargetRef === input.rollbackTargetRef &&
    existing.executionMode === (input.executionMode ?? ROLLBACK_EXECUTION_MODE.AUTOMATIC) &&
    existing.preflightStatus === (input.preflightStatus ?? ROLLBACK_PLAN_PREFLIGHT_STATUS.READY) &&
    existing.requiredEvidenceRefs.length === expectedRequiredEvidenceRefs.length &&
    existing.requiredEvidenceRefs.every((ref, index) => ref === expectedRequiredEvidenceRefs[index])
  );
};

const equivalentDeployAttempt = (
  existing: DeployAttempt,
  input: StartDeployAttemptInput,
): boolean =>
  existing.releaseRequestId === input.releaseRequestId &&
  existing.rollbackPlanId === input.rollbackPlanId &&
  existing.targetEnvironment === input.targetEnvironment &&
  existing.deploymentIdentity === input.deploymentIdentity &&
  existing.migrationState === input.migrationState;

const equivalentDeployCompletion = (
  existing: DeployAttempt,
  input: CompleteDeployAttemptInput,
): boolean =>
  existing.status === input.status &&
  (existing.failureReason ?? null) === (input.failureReason ?? null);

const firstRow = <T>(rows: T[]): T | null => rows[0] ?? null;

export const createReleaseAutomationStore = (
  db: ReleaseAutomationDbExecutor,
): ReleaseAutomationStore => {
  const getReleaseRequest = async (requestId: string): Promise<ReleaseRequestRow | null> => {
    const result = await db.query<QueryResultRow>(
      `select ${releaseRequestColumns}
       from ${releaseRequestsTable}
       where request_id = $1`,
      [requestId],
    );
    const row = firstRow(result.rows);
    return row ? normalizeRequestRow(row) : null;
  };

  const getRollbackPlan = async (rollbackPlanId: string): Promise<RollbackPlan | null> => {
    const result = await db.query<QueryResultRow>(
      `select ${rollbackPlanColumns}
       from ${rollbackPlansTable}
       where rollback_plan_id = $1`,
      [rollbackPlanId],
    );
    const row = firstRow(result.rows);
    return row ? normalizeRollbackPlanRow(row) : null;
  };

  return {
    assertOwnedWriteSurface(surface: string): void {
      assertReleaseAutomationOwnedWriteSurface(surface);
    },

    async createReleaseRequest(input): Promise<CreateReleaseRequestResult> {
      const request = releaseRequestSchema.parse(input);
      const normalizedRequestHash = hashRequest(request);
      const result = await db.query<QueryResultRow>(
        `insert into ${releaseRequestsTable} (
           request_id,
           normalized_request_hash,
           target_environment,
           git_ref,
           rollback_target_ref,
           actor_ref,
           source,
           requested_action,
           evidence_refs_json,
           requested_at,
           created_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz, $10::timestamptz)
         on conflict (request_id) do nothing
         returning ${releaseRequestColumns}`,
        [
          request.requestId,
          normalizedRequestHash,
          request.targetEnvironment,
          request.gitRef,
          request.rollbackTargetRef,
          request.actorRef,
          request.source,
          request.requestedAction,
          JSON.stringify(request.evidenceRefs),
          request.requestedAt,
        ],
      );
      const inserted = firstRow(result.rows);
      if (inserted) {
        return {
          accepted: true,
          deduplicated: false,
          request: normalizeRequestRow(inserted),
        };
      }

      const existing = await getReleaseRequest(request.requestId);
      if (!existing) {
        throw new Error(`release request ${request.requestId} disappeared after conflict`);
      }

      if (existing.normalizedRequestHash === normalizedRequestHash) {
        return {
          accepted: true,
          deduplicated: true,
          request: existing,
        };
      }

      return {
        accepted: false,
        reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
        existingRequest: existing,
      };
    },

    getReleaseRequest,

    async createRollbackPlan(input): Promise<CreateRollbackPlanResult> {
      const request = await getReleaseRequest(input.releaseRequestId);
      if (!request) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING,
        };
      }

      const result = await db.query<QueryResultRow>(
        `insert into ${rollbackPlansTable} (
           rollback_plan_id,
           release_request_id,
           deploy_attempt_id,
           rollback_target_ref,
           required_evidence_refs_json,
           execution_mode,
           preflight_status,
           created_at
         )
         values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz)
         on conflict (rollback_plan_id) do nothing
         returning ${rollbackPlanColumns}`,
        [
          input.rollbackPlanId,
          input.releaseRequestId,
          input.deployAttemptId ?? null,
          input.rollbackTargetRef,
          JSON.stringify(input.requiredEvidenceRefs),
          input.executionMode ?? ROLLBACK_EXECUTION_MODE.AUTOMATIC,
          input.preflightStatus ?? ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
          input.createdAt,
        ],
      );
      const inserted = firstRow(result.rows);
      if (inserted) {
        return {
          accepted: true,
          deduplicated: false,
          plan: normalizeRollbackPlanRow(inserted),
        };
      }

      const existing = await getRollbackPlan(input.rollbackPlanId);
      if (!existing) {
        throw new Error(`rollback plan ${input.rollbackPlanId} disappeared after conflict`);
      }

      if (!equivalentRollbackPlan(existing, input)) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
        };
      }

      return {
        accepted: true,
        deduplicated: true,
        plan: existing,
      };
    },

    getRollbackPlan,

    async getRollbackPlanForRequest(releaseRequestId): Promise<RollbackPlan | null> {
      const result = await db.query<QueryResultRow>(
        `select ${rollbackPlanColumns}
         from ${rollbackPlansTable}
         where release_request_id = $1
         order by created_at desc, rollback_plan_id desc
         limit 1`,
        [releaseRequestId],
      );
      const row = firstRow(result.rows);
      return row ? normalizeRollbackPlanRow(row) : null;
    },

    async startDeployAttempt(input): Promise<StartDeployAttemptResult> {
      const request = await getReleaseRequest(input.releaseRequestId);
      if (!request) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING,
        };
      }

      const rollbackPlan = await getRollbackPlan(input.rollbackPlanId);
      if (
        !rollbackPlan ||
        rollbackPlan.releaseRequestId !== input.releaseRequestId ||
        rollbackPlan.preflightStatus !== ROLLBACK_PLAN_PREFLIGHT_STATUS.READY
      ) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN,
        };
      }

      const existing = await db.query<QueryResultRow>(
        `select ${deployAttemptColumns}
         from ${deployAttemptsTable}
         where deploy_attempt_id = $1`,
        [input.deployAttemptId],
      );
      const existingRow = firstRow(existing.rows);
      if (existingRow) {
        const existingAttempt = normalizeDeployAttemptRow(existingRow);
        if (!equivalentDeployAttempt(existingAttempt, input)) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          };
        }

        return {
          accepted: true,
          deduplicated: true,
          attempt: existingAttempt,
        };
      }

      if (!input.evidenceStorageWritable) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.EVIDENCE_STORAGE_UNAVAILABLE,
        };
      }

      const result = await db.query<QueryResultRow>(
        `insert into ${deployAttemptsTable} (
           deploy_attempt_id,
           release_request_id,
           rollback_plan_id,
           target_environment,
           deployment_identity,
           migration_state,
           status,
           failure_reason,
           started_at,
           finished_at,
           created_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, null, $8::timestamptz, null, $8::timestamptz)
         on conflict (deploy_attempt_id) do nothing
         returning ${deployAttemptColumns}`,
        [
          input.deployAttemptId,
          input.releaseRequestId,
          input.rollbackPlanId,
          input.targetEnvironment,
          input.deploymentIdentity,
          input.migrationState,
          DEPLOY_ATTEMPT_STATUS.RUNNING,
          input.startedAt,
        ],
      );
      const inserted = firstRow(result.rows);
      if (inserted) {
        return {
          accepted: true,
          deduplicated: false,
          attempt: normalizeDeployAttemptRow(inserted),
        };
      }

      const conflict = await db.query<QueryResultRow>(
        `select ${deployAttemptColumns}
         from ${deployAttemptsTable}
         where deploy_attempt_id = $1`,
        [input.deployAttemptId],
      );
      const row = firstRow(conflict.rows);
      if (!row) {
        throw new Error(`deploy attempt ${input.deployAttemptId} disappeared after conflict`);
      }
      const existingAttempt = normalizeDeployAttemptRow(row);

      if (!equivalentDeployAttempt(existingAttempt, input)) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
        };
      }

      return {
        accepted: true,
        deduplicated: true,
        attempt: existingAttempt,
      };
    },

    async completeDeployAttempt(input): Promise<DeployAttempt | null> {
      const result = await db.query<QueryResultRow>(
        `update ${deployAttemptsTable}
	         set status = $2,
	             failure_reason = $3,
	             finished_at = $4::timestamptz
	         where deploy_attempt_id = $1
	           and status = 'running'
	         returning ${deployAttemptColumns}`,
        [input.deployAttemptId, input.status, input.failureReason ?? null, input.finishedAt],
      );
      const row =
        firstRow(result.rows) ??
        firstRow(
          (
            await db.query<QueryResultRow>(
              `select ${deployAttemptColumns}
	               from ${deployAttemptsTable}
	               where deploy_attempt_id = $1`,
              [input.deployAttemptId],
            )
          ).rows,
        );
      if (!row) {
        return null;
      }

      const attempt = normalizeDeployAttemptRow(row);
      if (result.rows.length === 0 && !equivalentDeployCompletion(attempt, input)) {
        return null;
      }
      return attempt;
    },

    async recordReleaseEvidence(input): Promise<RecordReleaseEvidenceResult> {
      const bundle = releaseEvidenceBundleSchema.parse(input);
      const result = await db.query<QueryResultRow>(
        `insert into ${releaseEvidenceTable} (
           evidence_bundle_id,
           release_request_id,
           deploy_attempt_id,
           commit_ref,
           deployment_identity,
           migration_state,
           smoke_on_deploy_result_json,
           model_serving_readiness_ref,
           governor_evidence_ref,
           lifecycle_rollback_target_ref,
           diagnostic_report_refs_json,
           file_artifact_refs_json,
           materialized_at,
           created_at
         )
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::jsonb, $12::jsonb, $13::timestamptz, $13::timestamptz)
         on conflict (evidence_bundle_id) do nothing
         returning ${releaseEvidenceColumns}`,
        [
          bundle.evidenceBundleId,
          bundle.releaseRequestId,
          bundle.deployAttemptId,
          bundle.commitRef,
          bundle.deploymentIdentity,
          bundle.migrationState,
          JSON.stringify(bundle.smokeOnDeployResult),
          bundle.modelServingReadinessRef,
          bundle.governorEvidenceRef,
          bundle.lifecycleRollbackTargetRef,
          JSON.stringify(bundle.diagnosticReportRefs),
          JSON.stringify(bundle.fileArtifactRefs),
          bundle.materializedAt,
        ],
      );
      const row =
        firstRow(result.rows) ??
        firstRow(
          (
            await db.query<QueryResultRow>(
              `select ${releaseEvidenceColumns}
               from ${releaseEvidenceTable}
               where evidence_bundle_id = $1`,
              [bundle.evidenceBundleId],
            )
          ).rows,
        );
      if (!row) {
        throw new Error(`release evidence ${bundle.evidenceBundleId} disappeared after conflict`);
      }

      const bundleRow = normalizeReleaseEvidenceRow(row);
      if (result.rows.length === 0 && !equivalentReleaseEvidenceBundle(bundleRow, bundle)) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          existingBundle: bundleRow,
        };
      }

      return {
        accepted: true,
        deduplicated: result.rows.length === 0,
        bundle: bundleRow,
      };
    },

    async recordRollbackExecution(input): Promise<RecordRollbackExecutionResult> {
      const execution = rollbackExecutionSchema.parse(input);
      const result = await db.query<QueryResultRow>(
        `insert into ${rollbackExecutionsTable} (
           rollback_execution_id,
           rollback_plan_id,
           deploy_attempt_id,
           trigger,
           status,
           evidence_refs_json,
           diagnostic_report_refs_json,
           executed_at,
           failure_reason,
           created_at
         )
         values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::timestamptz, $9, $8::timestamptz)
         on conflict do nothing
         returning ${rollbackExecutionColumns}`,
        [
          execution.rollbackExecutionId,
          execution.rollbackPlanId,
          execution.deployAttemptId,
          execution.trigger,
          execution.status,
          JSON.stringify(execution.evidenceRefs),
          JSON.stringify(execution.diagnosticReportRefs),
          execution.executedAt,
          execution.failureReason,
        ],
      );
      const row =
        firstRow(result.rows) ??
        firstRow(
          (
            await db.query<QueryResultRow>(
              `select ${rollbackExecutionColumns}
	               from ${rollbackExecutionsTable}
	               where rollback_execution_id = $1
	                  or (rollback_plan_id = $2 and deploy_attempt_id = $3)`,
              [execution.rollbackExecutionId, execution.rollbackPlanId, execution.deployAttemptId],
            )
          ).rows,
        );
      if (!row) {
        throw new Error(
          `rollback execution ${execution.rollbackExecutionId} disappeared after conflict`,
        );
      }

      const executionRow = normalizeRollbackExecutionRow(row);
      if (result.rows.length === 0 && !equivalentRollbackExecution(executionRow, execution)) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          existingExecution: executionRow,
        };
      }

      return {
        accepted: true,
        deduplicated: result.rows.length === 0,
        execution: executionRow,
      };
    },

    async completeRollbackExecution(input): Promise<CompleteRollbackExecutionResult> {
      const execution = rollbackExecutionSchema.parse(input);
      const result = await db.query<QueryResultRow>(
        `update ${rollbackExecutionsTable}
         set status = $5,
             evidence_refs_json = $6::jsonb,
             diagnostic_report_refs_json = $7::jsonb,
             executed_at = $8::timestamptz,
             failure_reason = $9
         where rollback_execution_id = $1
           and rollback_plan_id = $2
           and deploy_attempt_id = $3
           and trigger = $4
           and status = 'running'
         returning ${rollbackExecutionColumns}`,
        [
          execution.rollbackExecutionId,
          execution.rollbackPlanId,
          execution.deployAttemptId,
          execution.trigger,
          execution.status,
          JSON.stringify(execution.evidenceRefs),
          JSON.stringify(execution.diagnosticReportRefs),
          execution.executedAt,
          execution.failureReason,
        ],
      );
      const row =
        firstRow(result.rows) ??
        firstRow(
          (
            await db.query<QueryResultRow>(
              `select ${rollbackExecutionColumns}
               from ${rollbackExecutionsTable}
               where rollback_execution_id = $1`,
              [execution.rollbackExecutionId],
            )
          ).rows,
        );
      if (!row) {
        throw new Error(
          `rollback execution ${execution.rollbackExecutionId} disappeared before completion`,
        );
      }

      const executionRow = normalizeRollbackExecutionRow(row);
      if (result.rows.length === 0 && !equivalentRollbackExecution(executionRow, execution)) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          existingExecution: executionRow,
        };
      }

      return {
        accepted: true,
        deduplicated: result.rows.length === 0,
        execution: executionRow,
      };
    },

    async getRollbackExecution(rollbackExecutionId): Promise<RollbackExecution | null> {
      const result = await db.query<QueryResultRow>(
        `select ${rollbackExecutionColumns}
         from ${rollbackExecutionsTable}
         where rollback_execution_id = $1`,
        [rollbackExecutionId],
      );
      const row = firstRow(result.rows);
      return row ? normalizeRollbackExecutionRow(row) : null;
    },

    async inspectReleaseRequest(requestId): Promise<ReleaseInspection | null> {
      const request = await getReleaseRequest(requestId);
      if (!request) {
        return null;
      }

      const [rollbackPlan, deployAttempts, evidenceBundles, rollbackExecutions] = await Promise.all(
        [
          this.getRollbackPlanForRequest(requestId),
          db.query<QueryResultRow>(
            `select ${deployAttemptColumns}
             from ${deployAttemptsTable}
             where release_request_id = $1
             order by created_at desc, deploy_attempt_id desc`,
            [requestId],
          ),
          db.query<QueryResultRow>(
            `select ${releaseEvidenceColumns}
             from ${releaseEvidenceTable}
             where release_request_id = $1
             order by materialized_at desc, evidence_bundle_id desc`,
            [requestId],
          ),
          db.query<QueryResultRow>(
            `select ${rollbackExecutionColumnsForAlias('rex')}
             from ${rollbackExecutionsTable} rex
             join ${deployAttemptsTable} da on da.deploy_attempt_id = rex.deploy_attempt_id
             where da.release_request_id = $1
             order by rex.executed_at desc, rex.rollback_execution_id desc`,
            [requestId],
          ),
        ],
      );

      return {
        request,
        rollbackPlan,
        deployAttempts: deployAttempts.rows.map(normalizeDeployAttemptRow),
        evidenceBundles: evidenceBundles.rows.map(normalizeReleaseEvidenceRow),
        rollbackExecutions: rollbackExecutions.rows.map(normalizeRollbackExecutionRow),
      };
    },
  };
};

export const RELEASE_AUTOMATION_WRITE_SURFACES = Object.values(
  RELEASE_AUTOMATION_OWNED_WRITE_SURFACE,
);

export const isReleaseAutomationRejectionReason = (
  value: string,
): value is ReleaseAutomationRejectionReason =>
  Object.values(RELEASE_AUTOMATION_REJECTION_REASON).includes(
    value as ReleaseAutomationRejectionReason,
  );
