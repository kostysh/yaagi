import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Client, QueryResultRow } from 'pg';
import { DEVELOPMENT_PROPOSAL_DECISION_KIND } from '@yaagi/contracts/governor';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_AUTOMATION_REJECTION_REASON,
  RELEASE_REQUEST_SOURCE,
  RELEASE_REQUESTED_ACTION,
  RELEASE_SMOKE_STATUS,
  ROLLBACK_EXECUTION_MODE,
  ROLLBACK_EXECUTION_STATUS,
  ROLLBACK_EXECUTION_TRIGGER,
  ROLLBACK_PLAN_PREFLIGHT_STATUS,
  assertReleaseAutomationOwnedWriteSurface,
  type DeployAttempt,
  type ReleaseEvidenceBundle,
  type ReleaseInspection,
  type ReleaseRequestRow,
  type ReleaseRequestSource,
  type ReleaseTargetEnvironment,
  type RollbackExecution,
  type RollbackExecutionTrigger,
  type RollbackPlan,
} from '@yaagi/contracts/release-automation';
import {
  createReleaseAutomationStore,
  createRuntimeDbClient,
  type CreateReleaseRequestResult,
  type CreateRollbackPlanInput,
  type ReleaseAutomationStore,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from './core-config.ts';

const execFileAsync = promisify(execFile);

export type ReleaseAutomationSmokeResult = {
  status:
    | typeof RELEASE_SMOKE_STATUS.PASSED
    | typeof RELEASE_SMOKE_STATUS.FAILED
    | typeof RELEASE_SMOKE_STATUS.UNAVAILABLE;
  command: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  evidenceRef: string | null;
};

export type ReleaseAutomationSmokeRunner = () => Promise<ReleaseAutomationSmokeResult>;

export type ReleaseAutomationRollbackResult = {
  status:
    | typeof ROLLBACK_EXECUTION_STATUS.SUCCEEDED
    | typeof ROLLBACK_EXECUTION_STATUS.FAILED
    | typeof ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE;
  evidenceRefs: string[];
  failureReason: string | null;
};

export type ReleaseAutomationRollbackExecutor = (input: {
  rollbackPlan: RollbackPlan;
  deployAttempt: DeployAttempt;
  trigger: RollbackExecutionTrigger;
}) => Promise<ReleaseAutomationRollbackResult>;

export type PrepareReleaseInput = {
  requestId: string;
  targetEnvironment: ReleaseTargetEnvironment;
  gitRef: string;
  actorRef: string;
  source: ReleaseRequestSource;
  rollbackTargetRef: string;
  governorEvidenceRef: string;
  lifecycleRollbackTargetRef: string;
  modelServingReadinessRef: string;
  diagnosticReportRefs: string[];
  evidenceRefs?: string[];
  requestedAt?: string;
};

export type PrepareReleaseResult =
  | {
      accepted: true;
      request: ReleaseRequestRow;
      rollbackPlan: RollbackPlan;
      requestDeduplicated: boolean;
      rollbackPlanDeduplicated: boolean;
    }
  | {
      accepted: false;
      reason:
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.RESERVED_EVIDENCE_REF_REJECTED
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.DIAGNOSTIC_REPORT_UNAVAILABLE
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.LIFECYCLE_ROLLBACK_TARGET_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING;
      existingRequest?: ReleaseRequestRow;
    };

export type RunReleaseDeployAttemptInput = {
  requestId: string;
  deployAttemptId?: string;
  deploymentIdentity?: string;
  migrationState?: string;
};

export type RunReleaseDeployAttemptResult =
  | {
      accepted: true;
      request: ReleaseRequestRow;
      rollbackPlan: RollbackPlan;
      deployAttempt: DeployAttempt;
      evidenceBundle: ReleaseEvidenceBundle;
      rollbackExecution: RollbackExecution | null;
    }
  | {
      accepted: false;
      reason:
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.EVIDENCE_STORAGE_UNAVAILABLE
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.DIAGNOSTIC_REPORT_UNAVAILABLE
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.LIFECYCLE_ROLLBACK_TARGET_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.SMOKE_HARNESS_UNAVAILABLE;
    };

export type ExecuteReleaseRollbackInput = {
  requestId: string;
  deployAttemptId: string;
  rollbackPlanId?: string;
  trigger: RollbackExecutionTrigger;
};

export type ExecuteReleaseRollbackResult =
  | {
      accepted: true;
      rollbackExecution: RollbackExecution;
    }
  | {
      accepted: false;
      reason:
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.ROLLBACK_EXECUTOR_UNAVAILABLE;
    };

export type ReleaseAutomationService = {
  prepareRelease(input: PrepareReleaseInput): Promise<PrepareReleaseResult>;
  runDeployAttempt(input: RunReleaseDeployAttemptInput): Promise<RunReleaseDeployAttemptResult>;
  executeRollback(input: ExecuteReleaseRollbackInput): Promise<ExecuteReleaseRollbackResult>;
  inspectRelease(requestId: string): Promise<ReleaseInspection | null>;
};

export type ReleasePrerequisiteValidationInput = Pick<
  PrepareReleaseInput,
  | 'governorEvidenceRef'
  | 'lifecycleRollbackTargetRef'
  | 'modelServingReadinessRef'
  | 'diagnosticReportRefs'
>;

export type ReleasePrerequisiteValidationResult =
  | { accepted: true }
  | {
      accepted: false;
      reason:
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.DIAGNOSTIC_REPORT_UNAVAILABLE
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.LIFECYCLE_ROLLBACK_TARGET_MISSING
        | typeof RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE;
    };

export type ReleasePrerequisiteValidator = (
  input: ReleasePrerequisiteValidationInput,
) => Promise<ReleasePrerequisiteValidationResult>;

export type ReleaseAutomationServiceOptions = {
  store: ReleaseAutomationStore;
  evidenceRootPath: string;
  prerequisiteValidator: ReleasePrerequisiteValidator;
  smokeRunner?: ReleaseAutomationSmokeRunner | null;
  rollbackExecutor?: ReleaseAutomationRollbackExecutor | null;
  now?: () => string;
};

const hashRef = (prefix: string, value: string): string =>
  `${prefix}:${createHash('sha256').update(value).digest('hex').slice(0, 40)}`;

const defaultDeploymentIdentity = (
  targetEnvironment: ReleaseTargetEnvironment,
  requestId: string,
  deployAttemptId: string,
): string =>
  `${targetEnvironment}:${createHash('sha256')
    .update(`${requestId}:${deployAttemptId}`)
    .digest('hex')
    .slice(0, 16)}`;

const releaseEvidenceFileName = (deployAttemptId: string): string =>
  `${hashRef('release-evidence', deployAttemptId).replace(':', '-')}.json`;

const defaultNow = (): string => new Date().toISOString();

const uniqueRefs = (refs: readonly string[]): string[] =>
  Array.from(new Set(refs.map((ref) => ref.trim()).filter((ref) => ref.length > 0))).sort();

const GOVERNOR_DECISION_REF_PREFIX = 'development-proposal-decision:';
const LIFECYCLE_ROLLBACK_TARGET_REF_PREFIX = 'graceful_shutdown:';
const MODEL_PROFILE_HEALTH_REF_PREFIX = 'model_profile_health:';
const MODEL_HEALTH_REPORT_REF_PREFIX = 'report:model_health:';
const REPORT_RUN_REF_PREFIX = 'report-run:';
const OPERATOR_AUTH_EVIDENCE_REF_PREFIX = 'operator-auth-evidence:';

const isGovernorDecisionRef = (ref: string): boolean =>
  ref.startsWith(GOVERNOR_DECISION_REF_PREFIX);

const isLifecycleRollbackTargetRef = (ref: string): boolean =>
  ref.startsWith(LIFECYCLE_ROLLBACK_TARGET_REF_PREFIX);

const isModelReadinessRef = (ref: string): boolean =>
  ref.startsWith(MODEL_PROFILE_HEALTH_REF_PREFIX) || ref.startsWith(MODEL_HEALTH_REPORT_REF_PREFIX);

const isDiagnosticReportRef = (ref: string): boolean => ref.startsWith(REPORT_RUN_REF_PREFIX);

const isReservedPrerequisiteEvidenceRef = (ref: string): boolean =>
  isGovernorDecisionRef(ref) ||
  isLifecycleRollbackTargetRef(ref) ||
  isModelReadinessRef(ref) ||
  isDiagnosticReportRef(ref);

const findReservedSupplementalEvidenceRef = (refs: readonly string[] | undefined): string | null =>
  refs?.map((ref) => ref.trim()).find(isReservedPrerequisiteEvidenceRef) ?? null;

const idempotencyEvidenceRefs = (refs: readonly string[]): string[] =>
  uniqueRefs(refs).filter((ref) => !ref.startsWith(OPERATOR_AUTH_EVIDENCE_REF_PREFIX));

const sameRefs = (left: readonly string[], right: readonly string[]): boolean => {
  const normalizedLeft = uniqueRefs(left);
  const normalizedRight = uniqueRefs(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((ref, index) => ref === normalizedRight[index])
  );
};

const prepareEvidenceRefs = (input: PrepareReleaseInput): string[] =>
  uniqueRefs([
    ...(input.evidenceRefs ?? []),
    input.governorEvidenceRef,
    input.lifecycleRollbackTargetRef,
    input.modelServingReadinessRef,
    ...input.diagnosticReportRefs,
  ]);

const equivalentPreparedRequest = (
  existing: ReleaseRequestRow,
  input: PrepareReleaseInput,
  evidenceRefs: readonly string[],
): boolean =>
  existing.targetEnvironment === input.targetEnvironment &&
  existing.gitRef === input.gitRef &&
  existing.rollbackTargetRef === input.rollbackTargetRef &&
  existing.actorRef === input.actorRef &&
  existing.source === input.source &&
  existing.requestedAction === RELEASE_REQUESTED_ACTION.DEPLOY &&
  sameRefs(idempotencyEvidenceRefs(existing.evidenceRefs), idempotencyEvidenceRefs(evidenceRefs));

const expectedPrepareRollbackPlan = (
  input: PrepareReleaseInput,
  releaseRequestId: string,
  createdAt: string,
): CreateRollbackPlanInput => ({
  rollbackPlanId: hashRef('rollback-plan', input.requestId),
  releaseRequestId,
  rollbackTargetRef: input.rollbackTargetRef,
  requiredEvidenceRefs: uniqueRefs([
    input.governorEvidenceRef,
    input.lifecycleRollbackTargetRef,
    input.modelServingReadinessRef,
  ]),
  executionMode: ROLLBACK_EXECUTION_MODE.AUTOMATIC,
  preflightStatus: ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
  createdAt,
});

const equivalentPrepareRollbackPlan = (
  existing: RollbackPlan,
  input: CreateRollbackPlanInput,
): boolean =>
  existing.rollbackPlanId === input.rollbackPlanId &&
  existing.releaseRequestId === input.releaseRequestId &&
  existing.deployAttemptId === (input.deployAttemptId ?? null) &&
  existing.rollbackTargetRef === input.rollbackTargetRef &&
  existing.executionMode === (input.executionMode ?? ROLLBACK_EXECUTION_MODE.AUTOMATIC) &&
  existing.preflightStatus === (input.preflightStatus ?? ROLLBACK_PLAN_PREFLIGHT_STATUS.READY) &&
  sameRefs(existing.requiredEvidenceRefs, input.requiredEvidenceRefs);

const defaultRollbackExecutionId = (deployAttemptId: string): string =>
  hashRef('rollback-execution', deployAttemptId);

const equivalentRollbackExecutionRequest = (
  existing: RollbackExecution,
  input: {
    rollbackPlanId: string;
    deployAttemptId: string;
    trigger: RollbackExecutionTrigger;
  },
): boolean =>
  existing.rollbackPlanId === input.rollbackPlanId &&
  existing.deployAttemptId === input.deployAttemptId &&
  existing.trigger === input.trigger;

const rollbackReservationEvidenceRefs = (
  rollbackPlan: RollbackPlan,
  rollbackExecutionId: string,
): string[] =>
  uniqueRefs([
    `rollback-execution-reserved:${rollbackExecutionId}`,
    `rollback-plan:${rollbackPlan.rollbackPlanId}`,
    rollbackPlan.rollbackTargetRef,
  ]);

const criticalRollbackFailureEvidenceRefs = (
  rollbackPlan: RollbackPlan,
  deployAttempt: DeployAttempt,
  reason: string,
): string[] =>
  uniqueRefs([
    `critical-rollback-failure:${hashRef(
      'rollback-failure',
      `${deployAttempt.deployAttemptId}:${rollbackPlan.rollbackPlanId}:${reason}`,
    )}`,
    `rollback-plan:${rollbackPlan.rollbackPlanId}`,
    rollbackPlan.rollbackTargetRef,
    reason,
  ]);

const equivalentDeployAttemptInput = (
  existing: DeployAttempt,
  input: {
    releaseRequestId: string;
    rollbackPlanId: string;
    targetEnvironment: ReleaseTargetEnvironment;
    deploymentIdentity: string;
    migrationState: string;
  },
): boolean =>
  existing.releaseRequestId === input.releaseRequestId &&
  existing.rollbackPlanId === input.rollbackPlanId &&
  existing.targetEnvironment === input.targetEnvironment &&
  existing.deploymentIdentity === input.deploymentIdentity &&
  existing.migrationState === input.migrationState;

const missingRequiredRef = (
  input: Pick<
    PrepareReleaseInput,
    'governorEvidenceRef' | 'lifecycleRollbackTargetRef' | 'modelServingReadinessRef'
  >,
):
  | typeof RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING
  | typeof RELEASE_AUTOMATION_REJECTION_REASON.LIFECYCLE_ROLLBACK_TARGET_MISSING
  | typeof RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE
  | null => {
  if (input.governorEvidenceRef.trim().length === 0) {
    return RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING;
  }

  if (input.lifecycleRollbackTargetRef.trim().length === 0) {
    return RELEASE_AUTOMATION_REJECTION_REASON.LIFECYCLE_ROLLBACK_TARGET_MISSING;
  }

  if (input.modelServingReadinessRef.trim().length === 0) {
    return RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE;
  }

  return null;
};

const extractReleaseRefs = (
  request: ReleaseRequestRow,
): {
  governorEvidenceRef: string | null;
  lifecycleRollbackTargetRef: string | null;
  modelServingReadinessRef: string | null;
  diagnosticReportRefs: string[];
} => {
  const findRef = (predicate: (ref: string) => boolean): string | null =>
    request.evidenceRefs.find(predicate) ?? null;
  return {
    governorEvidenceRef: findRef(isGovernorDecisionRef),
    lifecycleRollbackTargetRef: findRef(isLifecycleRollbackTargetRef),
    modelServingReadinessRef: findRef(isModelReadinessRef),
    diagnosticReportRefs: request.evidenceRefs.filter(isDiagnosticReportRef),
  };
};

const ensureEvidenceRootWritable = async (evidenceRootPath: string): Promise<boolean> => {
  const probePath = path.join(evidenceRootPath, `.release-evidence-probe-${randomUUID()}`);
  try {
    await mkdir(evidenceRootPath, { recursive: true });
    await writeFile(probePath, 'ok\n', { encoding: 'utf8' });
    await rm(probePath, { force: true });
    return true;
  } catch {
    return false;
  }
};

const materializeEvidenceBundle = async (
  evidenceRootPath: string,
  bundle: ReleaseEvidenceBundle,
): Promise<string> => {
  await mkdir(evidenceRootPath, { recursive: true });
  const fileName = releaseEvidenceFileName(bundle.deployAttemptId);
  const artifactPath = path.join(evidenceRootPath, fileName);
  await writeFile(artifactPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  return `file:release-evidence:${fileName}`;
};

const rowValue = (row: QueryResultRow | undefined, key: string): unknown => row?.[key];

const withRuntimeDbClient = async <T>(
  connectionString: string,
  run: (client: Client) => Promise<T>,
): Promise<T> => {
  const client = createRuntimeDbClient(connectionString);
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
};

export const createCanonicalFormatReleasePrerequisiteValidator =
  (): ReleasePrerequisiteValidator => (input) => {
    const missingRef = missingRequiredRef(input);
    if (missingRef) {
      return Promise.resolve({ accepted: false, reason: missingRef });
    }

    if (!isGovernorDecisionRef(input.governorEvidenceRef)) {
      return Promise.resolve({
        accepted: false,
        reason: RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING,
      });
    }

    if (!isLifecycleRollbackTargetRef(input.lifecycleRollbackTargetRef)) {
      return Promise.resolve({
        accepted: false,
        reason: RELEASE_AUTOMATION_REJECTION_REASON.LIFECYCLE_ROLLBACK_TARGET_MISSING,
      });
    }

    if (!isModelReadinessRef(input.modelServingReadinessRef)) {
      return Promise.resolve({
        accepted: false,
        reason: RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE,
      });
    }

    if (input.diagnosticReportRefs.length === 0) {
      return Promise.resolve({
        accepted: false,
        reason: RELEASE_AUTOMATION_REJECTION_REASON.DIAGNOSTIC_REPORT_UNAVAILABLE,
      });
    }

    if (input.diagnosticReportRefs.some((ref) => !isDiagnosticReportRef(ref))) {
      return Promise.resolve({
        accepted: false,
        reason: RELEASE_AUTOMATION_REJECTION_REASON.DIAGNOSTIC_REPORT_UNAVAILABLE,
      });
    }

    return Promise.resolve({ accepted: true });
  };

const validateDbGovernorEvidenceRef = async (client: Client, ref: string): Promise<boolean> => {
  const result = await client.query<QueryResultRow>(
    `select decision_kind as "decisionKind"
     from polyphony_runtime.development_proposal_decisions
     where decision_id = $1
     limit 1`,
    [ref],
  );
  return rowValue(result.rows[0], 'decisionKind') === DEVELOPMENT_PROPOSAL_DECISION_KIND.APPROVED;
};

const validateDbLifecycleRollbackTargetRef = async (
  client: Client,
  ref: string,
): Promise<boolean> => {
  const shutdownEventId = ref.slice(LIFECYCLE_ROLLBACK_TARGET_REF_PREFIX.length);
  const result = await client.query<QueryResultRow>(
    `select shutdown_state as "shutdownState"
     from polyphony_runtime.graceful_shutdown_events
     where shutdown_event_id = $1
     limit 1`,
    [shutdownEventId],
  );
  return rowValue(result.rows[0], 'shutdownState') === 'completed';
};

const validateDbModelReadinessRef = async (client: Client, ref: string): Promise<boolean> => {
  if (ref.startsWith(MODEL_PROFILE_HEALTH_REF_PREFIX)) {
    const modelProfileId = ref.slice(MODEL_PROFILE_HEALTH_REF_PREFIX.length);
    const result = await client.query<QueryResultRow>(
      `select availability,
              quarantine_state as "quarantineState",
              healthy
       from polyphony_runtime.model_profile_health
       where model_profile_id = $1
       limit 1`,
      [modelProfileId],
    );
    const row = result.rows[0];
    return (
      rowValue(row, 'availability') !== 'unavailable' &&
      rowValue(row, 'quarantineState') === 'clear' &&
      rowValue(row, 'healthy') !== false
    );
  }

  if (ref.startsWith(MODEL_HEALTH_REPORT_REF_PREFIX)) {
    const profileOrOrganId = ref.slice(MODEL_HEALTH_REPORT_REF_PREFIX.length);
    const result = await client.query<QueryResultRow>(
      `select 1 as ok
       from polyphony_runtime.model_health_reports mhr
       inner join polyphony_runtime.report_runs rr on rr.report_run_id = mhr.report_run_id
       where (mhr.profile_id = $1 or mhr.organ_id = $1)
         and mhr.health_status <> 'unavailable'
         and mhr.availability_status <> 'unavailable'
         and rr.availability_status <> 'unavailable'
       order by mhr.materialized_at desc
       limit 1`,
      [profileOrOrganId],
    );
    return result.rows.length > 0;
  }

  return false;
};

const validateDbDiagnosticReportRefs = async (
  client: Client,
  refs: readonly string[],
): Promise<boolean> => {
  for (const ref of refs) {
    if (ref.startsWith(REPORT_RUN_REF_PREFIX)) {
      const result = await client.query<QueryResultRow>(
        `select availability_status as "availabilityStatus"
         from polyphony_runtime.report_runs
         where report_run_id = $1
         limit 1`,
        [ref],
      );
      if (
        result.rows.length === 0 ||
        rowValue(result.rows[0], 'availabilityStatus') === 'unavailable'
      ) {
        return false;
      }
    }
  }

  return true;
};

export const createDbReleasePrerequisiteValidator = (
  connectionString: string,
): ReleasePrerequisiteValidator => {
  const formatValidator = createCanonicalFormatReleasePrerequisiteValidator();
  return async (input) => {
    const formatResult = await formatValidator(input);
    if (!formatResult.accepted) {
      return formatResult;
    }

    return await withRuntimeDbClient(connectionString, async (client) => {
      if (!(await validateDbGovernorEvidenceRef(client, input.governorEvidenceRef))) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING,
        };
      }

      if (!(await validateDbLifecycleRollbackTargetRef(client, input.lifecycleRollbackTargetRef))) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.LIFECYCLE_ROLLBACK_TARGET_MISSING,
        };
      }

      if (!(await validateDbModelReadinessRef(client, input.modelServingReadinessRef))) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE,
        };
      }

      if (!(await validateDbDiagnosticReportRefs(client, input.diagnosticReportRefs))) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.DIAGNOSTIC_REPORT_UNAVAILABLE,
        };
      }

      return { accepted: true };
    });
  };
};

const unavailableRollbackExecutor: ReleaseAutomationRollbackExecutor = () =>
  Promise.resolve({
    status: ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE,
    evidenceRefs: [],
    failureReason: RELEASE_AUTOMATION_REJECTION_REASON.ROLLBACK_EXECUTOR_UNAVAILABLE,
  });

const execErrorExitCode = (error: unknown): number | null => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'number'
  ) {
    return (error as { code: number }).code;
  }

  return null;
};

export const createReleaseCellRollbackExecutor = (
  options: { cwd?: string; commandLabel?: string } = {},
): ReleaseAutomationRollbackExecutor => {
  const cwd = options.cwd ?? process.cwd();
  const commandLabel = options.commandLabel ?? 'pnpm cell:down';
  return async ({ rollbackPlan, deployAttempt, trigger }) => {
    try {
      await execFileAsync('pnpm', ['cell:down'], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: uniqueRefs([
          `release-cell-rollback:${hashRef(
            'execution',
            `${deployAttempt.deployAttemptId}:${rollbackPlan.rollbackTargetRef}:${trigger}`,
          )}`,
          `rollback-command:${commandLabel}`,
        ]),
        failureReason: null,
      };
    } catch (error) {
      const exitCode = execErrorExitCode(error);
      return {
        status: ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE,
        evidenceRefs: uniqueRefs([
          `release-cell-rollback-failed:${hashRef(
            'execution',
            `${deployAttempt.deployAttemptId}:${rollbackPlan.rollbackTargetRef}:${trigger}`,
          )}`,
          `rollback-command:${commandLabel}`,
        ]),
        failureReason:
          exitCode === null
            ? 'rollback_command_unavailable'
            : `rollback_command_failed:${exitCode}`,
      };
    }
  };
};

export const createPnpmSmokeCellRunner = (
  options: { cwd?: string; commandLabel?: string } = {},
): ReleaseAutomationSmokeRunner => {
  const cwd = options.cwd ?? process.cwd();
  const commandLabel = options.commandLabel ?? 'pnpm smoke:cell';
  return async () => {
    const startedAt = new Date().toISOString();
    try {
      await execFileAsync('pnpm', ['smoke:cell'], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: commandLabel,
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: 0,
        evidenceRef: null,
      };
    } catch (error) {
      const exitCode = execErrorExitCode(error);
      return {
        status: exitCode === null ? RELEASE_SMOKE_STATUS.UNAVAILABLE : RELEASE_SMOKE_STATUS.FAILED,
        command: commandLabel,
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode,
        evidenceRef: null,
      };
    }
  };
};

const completeRunningRollbackReservation = async (
  options: ReleaseAutomationServiceOptions,
  existingExecution: RollbackExecution,
  reason: string,
): Promise<
  | { accepted: true; execution: RollbackExecution }
  | {
      accepted: false;
      reason: typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
    }
> => {
  if (existingExecution.status !== ROLLBACK_EXECUTION_STATUS.RUNNING) {
    return { accepted: true, execution: existingExecution };
  }

  const criticalExecution: RollbackExecution = {
    ...existingExecution,
    status: ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE,
    evidenceRefs: uniqueRefs([
      ...existingExecution.evidenceRefs,
      `critical-rollback-failure:${hashRef(
        'rollback-failure',
        `${existingExecution.rollbackExecutionId}:${reason}`,
      )}`,
      reason,
    ]),
    executedAt: (options.now ?? defaultNow)(),
    failureReason: reason,
  };

  try {
    const result = await options.store.completeRollbackExecution(criticalExecution);
    if (result.accepted) {
      return { accepted: true, execution: result.execution };
    }
  } catch {
    // Keep the caller on the idempotency-conflict path when the store cannot
    // durably move the reservation into a terminal fail-closed state.
  }

  return {
    accepted: false,
    reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
  };
};

const recordRollback = async (
  options: ReleaseAutomationServiceOptions,
  input: {
    rollbackPlan: RollbackPlan;
    deployAttempt: DeployAttempt;
    trigger: RollbackExecutionTrigger;
    diagnosticReportRefs: string[];
  },
): Promise<
  | { accepted: true; execution: RollbackExecution }
  | {
      accepted: false;
      reason: typeof RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
    }
> => {
  const rollbackExecutionId = defaultRollbackExecutionId(input.deployAttempt.deployAttemptId);
  let existingExecution: RollbackExecution | null;
  try {
    existingExecution = await options.store.getRollbackExecution(rollbackExecutionId);
  } catch {
    return {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    };
  }
  if (existingExecution) {
    if (
      !equivalentRollbackExecutionRequest(existingExecution, {
        rollbackPlanId: input.rollbackPlan.rollbackPlanId,
        deployAttemptId: input.deployAttempt.deployAttemptId,
        trigger: input.trigger,
      })
    ) {
      return {
        accepted: false,
        reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
      };
    }

    if (existingExecution.status === ROLLBACK_EXECUTION_STATUS.RUNNING) {
      return await completeRunningRollbackReservation(
        options,
        existingExecution,
        'rollback_execution_replay_found_running',
      );
    }

    return { accepted: true, execution: existingExecution };
  }

  const rollbackExecutor = options.rollbackExecutor ?? unavailableRollbackExecutor;
  const request = {
    rollbackPlanId: input.rollbackPlan.rollbackPlanId,
    deployAttemptId: input.deployAttempt.deployAttemptId,
    trigger: input.trigger,
  };
  const reservedAt = (options.now ?? defaultNow)();
  const reservation: RollbackExecution = {
    rollbackExecutionId,
    rollbackPlanId: input.rollbackPlan.rollbackPlanId,
    deployAttemptId: input.deployAttempt.deployAttemptId,
    trigger: input.trigger,
    status: ROLLBACK_EXECUTION_STATUS.RUNNING,
    evidenceRefs: rollbackReservationEvidenceRefs(input.rollbackPlan, rollbackExecutionId),
    diagnosticReportRefs: input.diagnosticReportRefs,
    executedAt: reservedAt,
    failureReason: null,
  };
  let reservationResult: Awaited<ReturnType<ReleaseAutomationStore['recordRollbackExecution']>>;
  try {
    reservationResult = await options.store.recordRollbackExecution(reservation);
  } catch {
    try {
      const persistedExecution = await options.store.getRollbackExecution(rollbackExecutionId);
      if (persistedExecution && equivalentRollbackExecutionRequest(persistedExecution, request)) {
        return await completeRunningRollbackReservation(
          options,
          persistedExecution,
          'rollback_reservation_write_failed',
        );
      }
    } catch {
      // Fall through to the caller's critical rollback-failure evidence path.
    }
    return {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    };
  }
  if (!reservationResult.accepted) {
    if (equivalentRollbackExecutionRequest(reservationResult.existingExecution, request)) {
      return await completeRunningRollbackReservation(
        options,
        reservationResult.existingExecution,
        'rollback_execution_replay_found_running',
      );
    }
    return {
      accepted: false,
      reason: reservationResult.reason,
    };
  }
  if (reservationResult.deduplicated) {
    return await completeRunningRollbackReservation(
      options,
      reservationResult.execution,
      'rollback_execution_replay_found_running',
    );
  }

  let rollbackResult: ReleaseAutomationRollbackResult;
  try {
    rollbackResult = await rollbackExecutor({
      rollbackPlan: input.rollbackPlan,
      deployAttempt: input.deployAttempt,
      trigger: input.trigger,
    });
  } catch {
    rollbackResult = {
      status: ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE,
      evidenceRefs: ['rollback-executor-threw'],
      failureReason: 'rollback_executor_threw',
    };
  }
  const executedAt = (options.now ?? defaultNow)();
  const execution: RollbackExecution = {
    rollbackExecutionId,
    rollbackPlanId: input.rollbackPlan.rollbackPlanId,
    deployAttemptId: input.deployAttempt.deployAttemptId,
    trigger: input.trigger,
    status: rollbackResult.status,
    evidenceRefs: uniqueRefs([...reservation.evidenceRefs, ...rollbackResult.evidenceRefs]),
    diagnosticReportRefs: input.diagnosticReportRefs,
    executedAt,
    failureReason: rollbackResult.failureReason,
  };
  try {
    const result = await options.store.completeRollbackExecution(execution);
    if (!result.accepted) {
      if (equivalentRollbackExecutionRequest(result.existingExecution, request)) {
        return await completeRunningRollbackReservation(
          options,
          result.existingExecution,
          'rollback_terminal_write_conflict_found_running',
        );
      }
      return {
        accepted: false,
        reason: result.reason,
      };
    }
    return { accepted: true, execution: result.execution };
  } catch {
    return await completeRunningRollbackReservation(
      options,
      reservation,
      'rollback_terminal_write_failed',
    );
  }
};

const deployTerminalFromEvidence = (
  evidenceBundle: ReleaseEvidenceBundle,
  rollbackExecution: RollbackExecution | null,
): {
  status: DeployAttempt['status'];
  failureReason: string | null;
  finishedAt: string;
} => {
  if (evidenceBundle.smokeOnDeployResult.status === RELEASE_SMOKE_STATUS.PASSED) {
    return {
      status: DEPLOY_ATTEMPT_STATUS.SUCCEEDED,
      failureReason: null,
      finishedAt: evidenceBundle.smokeOnDeployResult.finishedAt,
    };
  }

  if (evidenceBundle.smokeOnDeployResult.status === RELEASE_SMOKE_STATUS.UNAVAILABLE) {
    return {
      status: DEPLOY_ATTEMPT_STATUS.FAILED,
      failureReason: RELEASE_AUTOMATION_REJECTION_REASON.SMOKE_HARNESS_UNAVAILABLE,
      finishedAt: evidenceBundle.smokeOnDeployResult.finishedAt,
    };
  }

  return {
    status:
      rollbackExecution?.status === ROLLBACK_EXECUTION_STATUS.SUCCEEDED
        ? DEPLOY_ATTEMPT_STATUS.ROLLED_BACK
        : DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED,
    failureReason: 'smoke_on_deploy_failed',
    finishedAt: rollbackExecution?.executedAt ?? evidenceBundle.smokeOnDeployResult.finishedAt,
  };
};

const buildReleaseEvidenceBundle = (input: {
  evidenceBundleId: string;
  request: ReleaseRequestRow;
  deployAttempt: DeployAttempt;
  smokeResult: ReleaseAutomationSmokeResult;
  releaseRefs: {
    governorEvidenceRef: string;
    lifecycleRollbackTargetRef: string;
    modelServingReadinessRef: string;
    diagnosticReportRefs: string[];
  };
  materializedAt: string;
  fileArtifactRefs?: string[];
}): ReleaseEvidenceBundle => ({
  evidenceBundleId: input.evidenceBundleId,
  releaseRequestId: input.request.requestId,
  deployAttemptId: input.deployAttempt.deployAttemptId,
  commitRef: input.request.gitRef,
  deploymentIdentity: input.deployAttempt.deploymentIdentity,
  migrationState: input.deployAttempt.migrationState,
  smokeOnDeployResult: {
    status: input.smokeResult.status,
    command: input.smokeResult.command,
    startedAt: input.smokeResult.startedAt,
    finishedAt: input.smokeResult.finishedAt,
    exitCode: input.smokeResult.exitCode,
    evidenceRef: input.smokeResult.evidenceRef,
  },
  modelServingReadinessRef: input.releaseRefs.modelServingReadinessRef,
  governorEvidenceRef: input.releaseRefs.governorEvidenceRef,
  lifecycleRollbackTargetRef: input.releaseRefs.lifecycleRollbackTargetRef,
  diagnosticReportRefs: input.releaseRefs.diagnosticReportRefs,
  fileArtifactRefs: input.fileArtifactRefs ?? [],
  materializedAt: input.materializedAt,
});

export const createReleaseAutomationService = (
  options: ReleaseAutomationServiceOptions,
): ReleaseAutomationService => {
  const now = options.now ?? defaultNow;

  return {
    async prepareRelease(input): Promise<PrepareReleaseResult> {
      const missingRef = missingRequiredRef(input);
      if (missingRef) {
        return {
          accepted: false,
          reason: missingRef,
        };
      }

      if (findReservedSupplementalEvidenceRef(input.evidenceRefs)) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.RESERVED_EVIDENCE_REF_REJECTED,
        };
      }

      const requestedAt = input.requestedAt ?? now();
      const evidenceRefs = prepareEvidenceRefs(input);
      const existingRequest = await options.store.getReleaseRequest(input.requestId);
      if (existingRequest) {
        const expectedRollbackPlan = expectedPrepareRollbackPlan(
          input,
          existingRequest.requestId,
          requestedAt,
        );
        if (!equivalentPreparedRequest(existingRequest, input, evidenceRefs)) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
            existingRequest,
          };
        }

        const existingRollbackPlan = await options.store.getRollbackPlanForRequest(input.requestId);
        if (existingRollbackPlan) {
          if (!equivalentPrepareRollbackPlan(existingRollbackPlan, expectedRollbackPlan)) {
            return {
              accepted: false,
              reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
              existingRequest,
            };
          }

          return {
            accepted: true,
            request: existingRequest,
            rollbackPlan: existingRollbackPlan,
            requestDeduplicated: true,
            rollbackPlanDeduplicated: true,
          };
        }

        const rollbackPlanResult = await options.store.createRollbackPlan(expectedRollbackPlan);
        if (!rollbackPlanResult.accepted) {
          return {
            accepted: false,
            reason: rollbackPlanResult.reason,
            existingRequest,
          };
        }

        return {
          accepted: true,
          request: existingRequest,
          rollbackPlan: rollbackPlanResult.plan,
          requestDeduplicated: true,
          rollbackPlanDeduplicated: rollbackPlanResult.deduplicated,
        };
      }

      const prerequisiteResult = await options.prerequisiteValidator({
        governorEvidenceRef: input.governorEvidenceRef,
        lifecycleRollbackTargetRef: input.lifecycleRollbackTargetRef,
        modelServingReadinessRef: input.modelServingReadinessRef,
        diagnosticReportRefs: input.diagnosticReportRefs,
      });
      if (!prerequisiteResult.accepted) {
        return prerequisiteResult;
      }
      const requestResult: CreateReleaseRequestResult = await options.store.createReleaseRequest({
        requestId: input.requestId,
        targetEnvironment: input.targetEnvironment,
        gitRef: input.gitRef,
        actorRef: input.actorRef,
        source: input.source,
        requestedAction: RELEASE_REQUESTED_ACTION.DEPLOY,
        rollbackTargetRef: input.rollbackTargetRef,
        evidenceRefs,
        requestedAt,
      });

      if (!requestResult.accepted) {
        return {
          accepted: false,
          reason: requestResult.reason,
          existingRequest: requestResult.existingRequest,
        };
      }

      const rollbackPlanResult = await options.store.createRollbackPlan(
        expectedPrepareRollbackPlan(input, requestResult.request.requestId, requestedAt),
      );

      if (!rollbackPlanResult.accepted) {
        return {
          accepted: false,
          reason: rollbackPlanResult.reason,
        };
      }

      return {
        accepted: true,
        request: requestResult.request,
        rollbackPlan: rollbackPlanResult.plan,
        requestDeduplicated: requestResult.deduplicated,
        rollbackPlanDeduplicated: rollbackPlanResult.deduplicated,
      };
    },

    async runDeployAttempt(input): Promise<RunReleaseDeployAttemptResult> {
      const request = await options.store.getReleaseRequest(input.requestId);
      if (!request) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING,
        };
      }

      const rollbackPlan = await options.store.getRollbackPlanForRequest(request.requestId);
      if (!rollbackPlan) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN,
        };
      }

      const startedAt = now();
      const deployAttemptId = input.deployAttemptId ?? hashRef('deploy-attempt', request.requestId);
      const deployAttemptInput = {
        releaseRequestId: request.requestId,
        rollbackPlanId: rollbackPlan.rollbackPlanId,
        targetEnvironment: request.targetEnvironment,
        deploymentIdentity:
          input.deploymentIdentity ??
          defaultDeploymentIdentity(request.targetEnvironment, request.requestId, deployAttemptId),
        migrationState: input.migrationState ?? 'schema:latest',
      };
      const inspectionBeforePreflight = await options.store.inspectReleaseRequest(
        request.requestId,
      );
      const existingAttempt =
        inspectionBeforePreflight?.deployAttempts.find(
          (attempt) => attempt.deployAttemptId === deployAttemptId,
        ) ?? null;
      if (existingAttempt) {
        if (!equivalentDeployAttemptInput(existingAttempt, deployAttemptInput)) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          };
        }

        const evidenceBundle =
          inspectionBeforePreflight?.evidenceBundles.find(
            (bundle) => bundle.deployAttemptId === deployAttemptId,
          ) ?? null;
        if (!evidenceBundle) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          };
        }
        const rollbackExecution =
          inspectionBeforePreflight?.rollbackExecutions.find(
            (execution) => execution.deployAttemptId === deployAttemptId,
          ) ?? null;
        const terminal = deployTerminalFromEvidence(evidenceBundle, rollbackExecution);
        let replayAttempt = existingAttempt;
        if (replayAttempt.status === DEPLOY_ATTEMPT_STATUS.RUNNING) {
          const completedAttempt = await options.store.completeDeployAttempt({
            deployAttemptId: replayAttempt.deployAttemptId,
            status: terminal.status,
            failureReason: terminal.failureReason,
            finishedAt: terminal.finishedAt,
          });
          if (!completedAttempt) {
            return {
              accepted: false,
              reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
            };
          }
          replayAttempt = completedAttempt;
        } else if (replayAttempt.status !== terminal.status) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          };
        }

        return {
          accepted: true,
          request,
          rollbackPlan,
          deployAttempt: replayAttempt,
          evidenceBundle,
          rollbackExecution,
        };
      }

      const releaseRefs = extractReleaseRefs(request);
      if (!releaseRefs.governorEvidenceRef) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING,
        };
      }

      if (!releaseRefs.lifecycleRollbackTargetRef) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.LIFECYCLE_ROLLBACK_TARGET_MISSING,
        };
      }

      if (!releaseRefs.modelServingReadinessRef) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE,
        };
      }
      const resolvedReleaseRefs = {
        governorEvidenceRef: releaseRefs.governorEvidenceRef,
        lifecycleRollbackTargetRef: releaseRefs.lifecycleRollbackTargetRef,
        modelServingReadinessRef: releaseRefs.modelServingReadinessRef,
        diagnosticReportRefs: releaseRefs.diagnosticReportRefs,
      };

      const prerequisiteResult = await options.prerequisiteValidator({
        governorEvidenceRef: releaseRefs.governorEvidenceRef,
        lifecycleRollbackTargetRef: releaseRefs.lifecycleRollbackTargetRef,
        modelServingReadinessRef: releaseRefs.modelServingReadinessRef,
        diagnosticReportRefs: releaseRefs.diagnosticReportRefs,
      });
      if (!prerequisiteResult.accepted) {
        return prerequisiteResult;
      }

      const evidenceStorageWritable = await ensureEvidenceRootWritable(options.evidenceRootPath);
      if (!evidenceStorageWritable) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.EVIDENCE_STORAGE_UNAVAILABLE,
        };
      }

      if (!options.smokeRunner) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.SMOKE_HARNESS_UNAVAILABLE,
        };
      }

      const deployAttemptResult = await options.store.startDeployAttempt({
        deployAttemptId,
        ...deployAttemptInput,
        evidenceStorageWritable,
        startedAt,
      });

      if (!deployAttemptResult.accepted) {
        return deployAttemptResult;
      }

      if (deployAttemptResult.deduplicated) {
        const inspection = await options.store.inspectReleaseRequest(request.requestId);
        const evidenceBundle =
          inspection?.evidenceBundles.find(
            (bundle) => bundle.deployAttemptId === deployAttemptResult.attempt.deployAttemptId,
          ) ?? null;
        if (!evidenceBundle) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          };
        }
        const rollbackExecution =
          inspection?.rollbackExecutions.find(
            (execution) =>
              execution.deployAttemptId === deployAttemptResult.attempt.deployAttemptId,
          ) ?? null;
        const terminal = deployTerminalFromEvidence(evidenceBundle, rollbackExecution);
        let replayAttempt = deployAttemptResult.attempt;
        if (replayAttempt.status === DEPLOY_ATTEMPT_STATUS.RUNNING) {
          const completedAttempt = await options.store.completeDeployAttempt({
            deployAttemptId: replayAttempt.deployAttemptId,
            status: terminal.status,
            failureReason: terminal.failureReason,
            finishedAt: terminal.finishedAt,
          });
          if (!completedAttempt) {
            return {
              accepted: false,
              reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
            };
          }
          replayAttempt = completedAttempt;
        } else if (replayAttempt.status !== terminal.status) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          };
        }
        return {
          accepted: true,
          request,
          rollbackPlan,
          deployAttempt: replayAttempt,
          evidenceBundle,
          rollbackExecution,
        };
      }

      let smokeResult: ReleaseAutomationSmokeResult;
      try {
        smokeResult = await options.smokeRunner();
      } catch {
        const smokeFailedAt = now();
        smokeResult = {
          status: RELEASE_SMOKE_STATUS.UNAVAILABLE,
          command: 'smoke-runner',
          startedAt: smokeFailedAt,
          finishedAt: smokeFailedAt,
          exitCode: null,
          evidenceRef: null,
        };
      }
      const smokePassed = smokeResult.status === RELEASE_SMOKE_STATUS.PASSED;
      const smokeUnavailable = smokeResult.status === RELEASE_SMOKE_STATUS.UNAVAILABLE;
      let rollbackExecution: RollbackExecution | null = null;
      let terminalStatus: DeployAttempt['status'] = DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED;
      let terminalFailureReason: string | null = 'smoke_on_deploy_failed';
      if (smokePassed) {
        terminalStatus = DEPLOY_ATTEMPT_STATUS.SUCCEEDED;
        terminalFailureReason = null;
      } else if (smokeUnavailable) {
        terminalStatus = DEPLOY_ATTEMPT_STATUS.FAILED;
        terminalFailureReason = RELEASE_AUTOMATION_REJECTION_REASON.SMOKE_HARNESS_UNAVAILABLE;
      }
      let terminalFinishedAt = smokeResult.finishedAt;
      let criticalRollbackFailureRefs: string[] = [];

      if (!smokePassed && !smokeUnavailable) {
        const rollbackResult = await recordRollback(options, {
          rollbackPlan,
          deployAttempt: deployAttemptResult.attempt,
          trigger: ROLLBACK_EXECUTION_TRIGGER.AUTO_SMOKE_FAILURE,
          diagnosticReportRefs: releaseRefs.diagnosticReportRefs,
        });
        if (!rollbackResult.accepted) {
          terminalStatus = DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED;
          terminalFailureReason = `critical_rollback_failure:${rollbackResult.reason}`;
          terminalFinishedAt = now();
          criticalRollbackFailureRefs = criticalRollbackFailureEvidenceRefs(
            rollbackPlan,
            deployAttemptResult.attempt,
            rollbackResult.reason,
          );
        } else {
          rollbackExecution = rollbackResult.execution;
          terminalFinishedAt = rollbackExecution.executedAt;

          if (rollbackExecution.status === ROLLBACK_EXECUTION_STATUS.SUCCEEDED) {
            terminalStatus = DEPLOY_ATTEMPT_STATUS.ROLLED_BACK;
          }
        }
      }

      const materializedAt = now();
      const evidenceBundleId = hashRef(
        'release-evidence',
        deployAttemptResult.attempt.deployAttemptId,
      );
      const bundleWithoutFiles = buildReleaseEvidenceBundle({
        evidenceBundleId,
        request,
        deployAttempt: deployAttemptResult.attempt,
        smokeResult,
        releaseRefs: resolvedReleaseRefs,
        materializedAt,
      });
      let artifactRef: string;
      try {
        artifactRef = await materializeEvidenceBundle(options.evidenceRootPath, bundleWithoutFiles);
      } catch {
        await options.store.completeDeployAttempt({
          deployAttemptId: deployAttemptResult.attempt.deployAttemptId,
          status: DEPLOY_ATTEMPT_STATUS.FAILED,
          failureReason: RELEASE_AUTOMATION_REJECTION_REASON.EVIDENCE_STORAGE_UNAVAILABLE,
          finishedAt: now(),
        });
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.EVIDENCE_STORAGE_UNAVAILABLE,
        };
      }
      let evidenceResult: Awaited<ReturnType<ReleaseAutomationStore['recordReleaseEvidence']>>;
      try {
        evidenceResult = await options.store.recordReleaseEvidence({
          ...bundleWithoutFiles,
          fileArtifactRefs: uniqueRefs([artifactRef, ...criticalRollbackFailureRefs]),
        });
      } catch {
        await options.store.completeDeployAttempt({
          deployAttemptId: deployAttemptResult.attempt.deployAttemptId,
          status: DEPLOY_ATTEMPT_STATUS.FAILED,
          failureReason: 'release_evidence_persistence_failed',
          finishedAt: now(),
        });
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
        };
      }
      if (!evidenceResult.accepted) {
        await options.store.completeDeployAttempt({
          deployAttemptId: deployAttemptResult.attempt.deployAttemptId,
          status: DEPLOY_ATTEMPT_STATUS.FAILED,
          failureReason: 'release_evidence_conflict',
          finishedAt: now(),
        });
        return {
          accepted: false,
          reason: evidenceResult.reason,
        };
      }
      const evidenceBundle = evidenceResult.bundle;
      const finalAttempt = await options.store.completeDeployAttempt({
        deployAttemptId: deployAttemptResult.attempt.deployAttemptId,
        status: terminalStatus,
        failureReason: terminalFailureReason,
        finishedAt: terminalFinishedAt,
      });
      if (!finalAttempt) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
        };
      }

      return {
        accepted: true,
        request,
        rollbackPlan,
        deployAttempt: finalAttempt,
        evidenceBundle,
        rollbackExecution,
      };
    },

    async executeRollback(input): Promise<ExecuteReleaseRollbackResult> {
      const request = await options.store.getReleaseRequest(input.requestId);
      if (!request) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING,
        };
      }

      const rollbackPlan = input.rollbackPlanId
        ? await options.store.getRollbackPlan(input.rollbackPlanId)
        : await options.store.getRollbackPlanForRequest(request.requestId);
      if (!rollbackPlan) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN,
        };
      }

      const inspection = await options.store.inspectReleaseRequest(input.requestId);
      const deployAttempt =
        inspection?.deployAttempts.find(
          (attempt) => attempt.deployAttemptId === input.deployAttemptId,
        ) ?? null;
      if (!deployAttempt) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING,
        };
      }

      if (
        rollbackPlan.releaseRequestId !== request.requestId ||
        deployAttempt.rollbackPlanId !== rollbackPlan.rollbackPlanId ||
        (rollbackPlan.deployAttemptId !== null &&
          rollbackPlan.deployAttemptId !== deployAttempt.deployAttemptId)
      ) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN,
        };
      }

      if (!options.rollbackExecutor) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.ROLLBACK_EXECUTOR_UNAVAILABLE,
        };
      }

      const rollbackInput = {
        rollbackPlan,
        deployAttempt,
        trigger: input.trigger,
        diagnosticReportRefs: extractReleaseRefs(request).diagnosticReportRefs,
      };
      const execution = await recordRollback(options, {
        ...rollbackInput,
      });
      if (!execution.accepted) {
        return execution;
      }
      return {
        accepted: true,
        rollbackExecution: execution.execution,
      };
    },

    inspectRelease(requestId): Promise<ReleaseInspection | null> {
      return options.store.inspectReleaseRequest(requestId);
    },
  };
};

const withReleaseStore = async <T>(
  connectionString: string,
  run: (store: ReleaseAutomationStore) => Promise<T>,
): Promise<T> =>
  await withRuntimeDbClient(connectionString, async (client) =>
    run(createReleaseAutomationStore(client)),
  );

export const createDbBackedReleaseAutomationService = (
  config: CoreRuntimeConfig,
  options: {
    smokeRunner?: ReleaseAutomationSmokeRunner | null;
    rollbackExecutor?: ReleaseAutomationRollbackExecutor | null;
    now?: () => string;
  } = {},
): ReleaseAutomationService => {
  const store: ReleaseAutomationStore = {
    assertOwnedWriteSurface: (surface) => {
      assertReleaseAutomationOwnedWriteSurface(surface);
    },
    createReleaseRequest: (input) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.createReleaseRequest(input),
      ),
    getReleaseRequest: (requestId) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.getReleaseRequest(requestId),
      ),
    createRollbackPlan: (input) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.createRollbackPlan(input),
      ),
    getRollbackPlan: (rollbackPlanId) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.getRollbackPlan(rollbackPlanId),
      ),
    getRollbackPlanForRequest: (releaseRequestId) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.getRollbackPlanForRequest(releaseRequestId),
      ),
    startDeployAttempt: (input) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.startDeployAttempt(input),
      ),
    completeDeployAttempt: (input) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.completeDeployAttempt(input),
      ),
    recordReleaseEvidence: (input) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.recordReleaseEvidence(input),
      ),
    recordRollbackExecution: (input) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.recordRollbackExecution(input),
      ),
    completeRollbackExecution: (input) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.completeRollbackExecution(input),
      ),
    getRollbackExecution: (rollbackExecutionId) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.getRollbackExecution(rollbackExecutionId),
      ),
    inspectReleaseRequest: (requestId) =>
      withReleaseStore(config.postgresUrl, (releaseStore) =>
        releaseStore.inspectReleaseRequest(requestId),
      ),
  };

  return createReleaseAutomationService({
    store,
    evidenceRootPath:
      config.releaseEvidenceRootPath ?? path.join(config.dataPath, 'release-evidence'),
    prerequisiteValidator: createDbReleasePrerequisiteValidator(config.postgresUrl),
    smokeRunner: options.smokeRunner ?? null,
    rollbackExecutor: options.rollbackExecutor ?? null,
    ...(options.now ? { now: options.now } : {}),
  });
};

export const buildCliReleasePrepareInput = (input: {
  requestId: string;
  targetEnvironment: ReleaseTargetEnvironment;
  gitRef: string;
  actorRef: string;
  source?: ReleaseRequestSource;
  rollbackTargetRef: string;
  governorEvidenceRef: string;
  lifecycleRollbackTargetRef: string;
  modelServingReadinessRef: string;
  diagnosticReportRefs: string[];
  evidenceRefs?: string[];
}): PrepareReleaseInput => ({
  requestId: input.requestId,
  targetEnvironment: input.targetEnvironment,
  gitRef: input.gitRef,
  actorRef: input.actorRef,
  source: input.source ?? RELEASE_REQUEST_SOURCE.CLI,
  rollbackTargetRef: input.rollbackTargetRef,
  governorEvidenceRef: input.governorEvidenceRef,
  lifecycleRollbackTargetRef: input.lifecycleRollbackTargetRef,
  modelServingReadinessRef: input.modelServingReadinessRef,
  diagnosticReportRefs: input.diagnosticReportRefs,
  evidenceRefs: input.evidenceRefs ?? [],
});
