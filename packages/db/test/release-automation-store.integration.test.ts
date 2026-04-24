import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_AUTOMATION_FOREIGN_WRITE_SURFACE,
  RELEASE_AUTOMATION_REJECTION_REASON,
  RELEASE_REQUEST_SOURCE,
  RELEASE_TARGET_ENVIRONMENT,
  RELEASE_SMOKE_STATUS,
  ROLLBACK_EXECUTION_MODE,
  ROLLBACK_EXECUTION_STATUS,
  ROLLBACK_EXECUTION_TRIGGER,
  ROLLBACK_PLAN_PREFLIGHT_STATUS,
  type DeployAttempt,
  type ReleaseEvidenceBundle,
  type ReleaseRequestRow,
  type RollbackExecution,
  type RollbackPlan,
} from '@yaagi/contracts/release-automation';
import {
  createReleaseAutomationStore,
  type ReleaseAutomationDbExecutor,
} from '../src/release-automation.ts';

type HarnessState = {
  releaseRequests: ReleaseRequestRow[];
  rollbackPlans: RollbackPlan[];
  deployAttempts: DeployAttempt[];
  evidenceBundles: ReleaseEvidenceBundle[];
  rollbackExecutions: RollbackExecution[];
};

const normalizeSql = (sqlText: string): string => sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

const parseJson = <T>(value: unknown): T => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
};

const sortDesc = <T extends { createdAt?: string; materializedAt?: string; executedAt?: string }>(
  rows: T[],
  field: keyof T,
): T[] =>
  [...rows].sort((left, right) =>
    String(right[field] ?? '').localeCompare(String(left[field] ?? '')),
  );

const createReleaseAutomationDbHarness = (): {
  db: ReleaseAutomationDbExecutor;
  state: HarnessState;
} => {
  const state: HarnessState = {
    releaseRequests: [],
    rollbackPlans: [],
    deployAttempts: [],
    evidenceBundles: [],
    rollbackExecutions: [],
  };

  const query = ((sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('release automation db harness supports only text queries');
    }

    const sql = normalizeSql(sqlText);

    if (sql.startsWith('insert into polyphony_runtime.release_requests')) {
      const existing = state.releaseRequests.find((row) => row.requestId === params[0]);
      if (existing) {
        return Promise.resolve({ rows: [] });
      }
      const row: ReleaseRequestRow = {
        requestId: String(params[0]),
        normalizedRequestHash: String(params[1]),
        targetEnvironment: params[2] as ReleaseRequestRow['targetEnvironment'],
        gitRef: String(params[3]),
        rollbackTargetRef: String(params[4]),
        actorRef: String(params[5]),
        source: params[6] as ReleaseRequestRow['source'],
        requestedAction: params[7] as ReleaseRequestRow['requestedAction'],
        evidenceRefs: parseJson<string[]>(params[8]),
        requestedAt: String(params[9]),
        createdAt: String(params[9]),
      };
      state.releaseRequests.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.release_requests') &&
      sql.includes('where request_id = $1')
    ) {
      const row = state.releaseRequests.find((entry) => entry.requestId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.rollback_plans')) {
      const existing = state.rollbackPlans.find((row) => row.rollbackPlanId === params[0]);
      if (existing) {
        return Promise.resolve({ rows: [] });
      }
      const row: RollbackPlan = {
        rollbackPlanId: String(params[0]),
        releaseRequestId: String(params[1]),
        deployAttemptId: typeof params[2] === 'string' ? String(params[2]) : null,
        rollbackTargetRef: String(params[3]),
        requiredEvidenceRefs: parseJson<string[]>(params[4]),
        executionMode: params[5] as RollbackPlan['executionMode'],
        preflightStatus: params[6] as RollbackPlan['preflightStatus'],
        createdAt: String(params[7]),
      };
      state.rollbackPlans.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.rollback_plans') &&
      sql.includes('where rollback_plan_id = $1')
    ) {
      const row = state.rollbackPlans.find((entry) => entry.rollbackPlanId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (
      sql.includes('from polyphony_runtime.rollback_plans') &&
      sql.includes('where release_request_id = $1')
    ) {
      const [row] = sortDesc(
        state.rollbackPlans.filter((entry) => entry.releaseRequestId === params[0]),
        'createdAt',
      );
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.deploy_attempts')) {
      const existing = state.deployAttempts.find((row) => row.deployAttemptId === params[0]);
      if (existing) {
        return Promise.resolve({ rows: [] });
      }
      const row: DeployAttempt = {
        deployAttemptId: String(params[0]),
        releaseRequestId: String(params[1]),
        rollbackPlanId: String(params[2]),
        targetEnvironment: params[3] as DeployAttempt['targetEnvironment'],
        deploymentIdentity: String(params[4]),
        migrationState: String(params[5]),
        status: params[6] as DeployAttempt['status'],
        failureReason: null,
        startedAt: String(params[7]),
        finishedAt: null,
        createdAt: String(params[7]),
      };
      state.deployAttempts.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.deploy_attempts') &&
      sql.includes('where deploy_attempt_id = $1')
    ) {
      const row = state.deployAttempts.find((entry) => entry.deployAttemptId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('update polyphony_runtime.deploy_attempts')) {
      const row = state.deployAttempts.find((entry) => entry.deployAttemptId === params[0]);
      if (!row || row.status !== DEPLOY_ATTEMPT_STATUS.RUNNING) {
        return Promise.resolve({ rows: [] });
      }
      row.status = params[1] as DeployAttempt['status'];
      row.failureReason = typeof params[2] === 'string' ? String(params[2]) : null;
      row.finishedAt = String(params[3]);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.deploy_attempts') &&
      sql.includes('where release_request_id = $1')
    ) {
      return Promise.resolve({
        rows: sortDesc(
          state.deployAttempts.filter((entry) => entry.releaseRequestId === params[0]),
          'createdAt',
        ),
      });
    }

    if (sql.startsWith('insert into polyphony_runtime.release_evidence')) {
      const existing = state.evidenceBundles.find((row) => row.evidenceBundleId === params[0]);
      if (existing) {
        return Promise.resolve({ rows: [] });
      }
      const row: ReleaseEvidenceBundle = {
        evidenceBundleId: String(params[0]),
        releaseRequestId: String(params[1]),
        deployAttemptId: String(params[2]),
        commitRef: String(params[3]),
        deploymentIdentity: String(params[4]),
        migrationState: String(params[5]),
        smokeOnDeployResult: parseJson<ReleaseEvidenceBundle['smokeOnDeployResult']>(params[6]),
        modelServingReadinessRef: String(params[7]),
        governorEvidenceRef: String(params[8]),
        lifecycleRollbackTargetRef: String(params[9]),
        diagnosticReportRefs: parseJson<string[]>(params[10]),
        fileArtifactRefs: parseJson<string[]>(params[11]),
        materializedAt: String(params[12]),
      };
      state.evidenceBundles.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.release_evidence') &&
      sql.includes('where evidence_bundle_id = $1')
    ) {
      const row = state.evidenceBundles.find((entry) => entry.evidenceBundleId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (
      sql.includes('from polyphony_runtime.release_evidence') &&
      sql.includes('where release_request_id = $1')
    ) {
      return Promise.resolve({
        rows: sortDesc(
          state.evidenceBundles.filter((entry) => entry.releaseRequestId === params[0]),
          'materializedAt',
        ),
      });
    }

    if (sql.startsWith('insert into polyphony_runtime.rollback_executions')) {
      const existing = state.rollbackExecutions.find(
        (row) =>
          row.rollbackExecutionId === params[0] ||
          (row.rollbackPlanId === params[1] && row.deployAttemptId === params[2]),
      );
      if (existing) {
        return Promise.resolve({ rows: [] });
      }
      const row: RollbackExecution = {
        rollbackExecutionId: String(params[0]),
        rollbackPlanId: String(params[1]),
        deployAttemptId: String(params[2]),
        trigger: params[3] as RollbackExecution['trigger'],
        status: params[4] as RollbackExecution['status'],
        evidenceRefs: parseJson<string[]>(params[5]),
        diagnosticReportRefs: parseJson<string[]>(params[6]),
        executedAt: String(params[7]),
        failureReason: typeof params[8] === 'string' ? String(params[8]) : null,
      };
      state.rollbackExecutions.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('update polyphony_runtime.rollback_executions')) {
      const row = state.rollbackExecutions.find(
        (entry) =>
          entry.rollbackExecutionId === params[0] &&
          entry.rollbackPlanId === params[1] &&
          entry.deployAttemptId === params[2] &&
          entry.trigger === params[3] &&
          entry.status === ROLLBACK_EXECUTION_STATUS.RUNNING,
      );
      if (!row) {
        return Promise.resolve({ rows: [] });
      }
      row.status = params[4] as RollbackExecution['status'];
      row.evidenceRefs = parseJson<string[]>(params[5]);
      row.diagnosticReportRefs = parseJson<string[]>(params[6]);
      row.executedAt = String(params[7]);
      row.failureReason = typeof params[8] === 'string' ? String(params[8]) : null;
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.rollback_executions') &&
      sql.includes('where rollback_execution_id = $1')
    ) {
      const row = state.rollbackExecutions.find(
        (entry) =>
          entry.rollbackExecutionId === params[0] ||
          (entry.rollbackPlanId === params[1] && entry.deployAttemptId === params[2]),
      );
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (
      sql.includes('from polyphony_runtime.rollback_executions rex') &&
      sql.includes('join polyphony_runtime.deploy_attempts da')
    ) {
      const attemptIds = new Set(
        state.deployAttempts
          .filter((attempt) => attempt.releaseRequestId === params[0])
          .map((attempt) => attempt.deployAttemptId),
      );
      return Promise.resolve({
        rows: sortDesc(
          state.rollbackExecutions.filter((execution) => attemptIds.has(execution.deployAttemptId)),
          'executedAt',
        ),
      });
    }

    throw new Error(`unsupported sql in release automation db harness: ${sqlText}`);
  }) as ReleaseAutomationDbExecutor['query'];

  return { db: { query }, state };
};

const createRequestInput = (requestId = 'release-request:1') => ({
  requestId,
  targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
  gitRef: 'git:main',
  rollbackTargetRef: 'git:stable',
  actorRef: 'operator:release',
  source: RELEASE_REQUEST_SOURCE.CLI,
  requestedAction: 'deploy' as const,
  evidenceRefs: [
    'development-proposal-decision:1',
    'graceful_shutdown:shutdown-1',
    'report-run:development',
  ],
  requestedAt: '2026-04-24T17:40:00.000Z',
});

void test('AC-F0026-03 stores idempotent release requests and rejects conflicting replay', async () => {
  const harness = createReleaseAutomationDbHarness();
  const store = createReleaseAutomationStore(harness.db);

  const first = await store.createReleaseRequest(createRequestInput());
  const replay = await store.createReleaseRequest(createRequestInput());
  const authEvidenceReplay = await store.createReleaseRequest({
    ...createRequestInput(),
    evidenceRefs: [
      ...createRequestInput().evidenceRefs,
      'operator-auth-evidence:http-request-replay',
    ],
  });
  const conflict = await store.createReleaseRequest({
    ...createRequestInput(),
    gitRef: 'git:other',
  });
  const rollbackTargetConflict = await store.createReleaseRequest({
    ...createRequestInput(),
    rollbackTargetRef: 'git:other-stable',
  });

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(authEvidenceReplay.accepted, true);
  assert.equal(conflict.accepted, false);
  assert.equal(rollbackTargetConflict.accepted, false);
  if (
    first.accepted &&
    replay.accepted &&
    authEvidenceReplay.accepted &&
    !conflict.accepted &&
    !rollbackTargetConflict.accepted
  ) {
    assert.equal(first.deduplicated, false);
    assert.equal(replay.deduplicated, true);
    assert.equal(authEvidenceReplay.deduplicated, true);
    assert.equal(conflict.reason, RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT);
    assert.equal(
      rollbackTargetConflict.reason,
      RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    );
  }
  assert.equal(harness.state.releaseRequests.length, 1);
});

void test('AC-F0026-04 AC-F0026-06 blocks deploy attempts without rollback plan or writable evidence storage', async () => {
  const harness = createReleaseAutomationDbHarness();
  const store = createReleaseAutomationStore(harness.db);
  await store.createReleaseRequest(createRequestInput());

  const missingPlan = await store.startDeployAttempt({
    deployAttemptId: 'deploy-attempt:missing-plan',
    releaseRequestId: 'release-request:1',
    rollbackPlanId: 'rollback-plan:missing',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    deploymentIdentity: 'deployment:local:1',
    migrationState: 'schema:022',
    evidenceStorageWritable: true,
    startedAt: '2026-04-24T17:41:00.000Z',
  });

  await store.createRollbackPlan({
    rollbackPlanId: 'rollback-plan:1',
    releaseRequestId: 'release-request:1',
    rollbackTargetRef: 'git:stable',
    requiredEvidenceRefs: ['development-proposal-decision:1', 'graceful_shutdown:shutdown-1'],
    executionMode: ROLLBACK_EXECUTION_MODE.AUTOMATIC,
    preflightStatus: ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
    createdAt: '2026-04-24T17:41:10.000Z',
  });

  const noEvidenceStorage = await store.startDeployAttempt({
    deployAttemptId: 'deploy-attempt:no-evidence',
    releaseRequestId: 'release-request:1',
    rollbackPlanId: 'rollback-plan:1',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    deploymentIdentity: 'deployment:local:1',
    migrationState: 'schema:022',
    evidenceStorageWritable: false,
    startedAt: '2026-04-24T17:41:20.000Z',
  });

  const accepted = await store.startDeployAttempt({
    deployAttemptId: 'deploy-attempt:1',
    releaseRequestId: 'release-request:1',
    rollbackPlanId: 'rollback-plan:1',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    deploymentIdentity: 'deployment:local:1',
    migrationState: 'schema:022',
    evidenceStorageWritable: true,
    startedAt: '2026-04-24T17:41:30.000Z',
  });
  const replayWithoutEvidenceStorage = await store.startDeployAttempt({
    deployAttemptId: 'deploy-attempt:1',
    releaseRequestId: 'release-request:1',
    rollbackPlanId: 'rollback-plan:1',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    deploymentIdentity: 'deployment:local:1',
    migrationState: 'schema:022',
    evidenceStorageWritable: false,
    startedAt: '2026-04-24T17:41:40.000Z',
  });

  assert.deepEqual(missingPlan, {
    accepted: false,
    reason: RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN,
  });
  assert.deepEqual(noEvidenceStorage, {
    accepted: false,
    reason: RELEASE_AUTOMATION_REJECTION_REASON.EVIDENCE_STORAGE_UNAVAILABLE,
  });
  assert.equal(accepted.accepted, true);
  assert.equal(replayWithoutEvidenceStorage.accepted, true);
  if (replayWithoutEvidenceStorage.accepted) {
    assert.equal(replayWithoutEvidenceStorage.deduplicated, true);
  }
  assert.equal(harness.state.deployAttempts.length, 1);
});

void test('AC-F0026-03 deploy completion is idempotent and does not overwrite terminal state', async () => {
  const harness = createReleaseAutomationDbHarness();
  const store = createReleaseAutomationStore(harness.db);
  await store.createReleaseRequest(createRequestInput());
  await store.createRollbackPlan({
    rollbackPlanId: 'rollback-plan:1',
    releaseRequestId: 'release-request:1',
    rollbackTargetRef: 'git:stable',
    requiredEvidenceRefs: ['development-proposal-decision:1', 'graceful_shutdown:shutdown-1'],
    executionMode: ROLLBACK_EXECUTION_MODE.AUTOMATIC,
    preflightStatus: ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
    createdAt: '2026-04-24T17:41:10.000Z',
  });
  await store.startDeployAttempt({
    deployAttemptId: 'deploy-attempt:terminal-cas',
    releaseRequestId: 'release-request:1',
    rollbackPlanId: 'rollback-plan:1',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    deploymentIdentity: 'deployment:local:1',
    migrationState: 'schema:022',
    evidenceStorageWritable: true,
    startedAt: '2026-04-24T17:41:30.000Z',
  });

  const firstCompletion = await store.completeDeployAttempt({
    deployAttemptId: 'deploy-attempt:terminal-cas',
    status: DEPLOY_ATTEMPT_STATUS.FAILED,
    failureReason: 'release_evidence_persistence_failed',
    finishedAt: '2026-04-24T17:41:40.000Z',
  });
  const idempotentReplay = await store.completeDeployAttempt({
    deployAttemptId: 'deploy-attempt:terminal-cas',
    status: DEPLOY_ATTEMPT_STATUS.FAILED,
    failureReason: 'release_evidence_persistence_failed',
    finishedAt: '2026-04-24T17:41:41.000Z',
  });
  const overwriteAttempt = await store.completeDeployAttempt({
    deployAttemptId: 'deploy-attempt:terminal-cas',
    status: DEPLOY_ATTEMPT_STATUS.SUCCEEDED,
    failureReason: null,
    finishedAt: '2026-04-24T17:41:42.000Z',
  });

  assert.equal(firstCompletion?.status, DEPLOY_ATTEMPT_STATUS.FAILED);
  assert.equal(idempotentReplay?.status, DEPLOY_ATTEMPT_STATUS.FAILED);
  assert.equal(idempotentReplay?.finishedAt, '2026-04-24T17:41:40.000Z');
  assert.equal(overwriteAttempt, null);
  assert.equal(harness.state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.FAILED);
  assert.equal(
    harness.state.deployAttempts[0]?.failureReason,
    'release_evidence_persistence_failed',
  );
});

void test('AC-F0026-03 rejects conflicting rollback-plan and deploy-attempt replays', async () => {
  const harness = createReleaseAutomationDbHarness();
  const store = createReleaseAutomationStore(harness.db);
  await store.createReleaseRequest(createRequestInput());
  await store.createRollbackPlan({
    rollbackPlanId: 'rollback-plan:1',
    releaseRequestId: 'release-request:1',
    rollbackTargetRef: 'git:stable',
    requiredEvidenceRefs: ['development-proposal-decision:1', 'graceful_shutdown:shutdown-1'],
    executionMode: ROLLBACK_EXECUTION_MODE.AUTOMATIC,
    preflightStatus: ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
    createdAt: '2026-04-24T17:41:10.000Z',
  });

  const rollbackConflict = await store.createRollbackPlan({
    rollbackPlanId: 'rollback-plan:1',
    releaseRequestId: 'release-request:1',
    rollbackTargetRef: 'git:different-stable',
    requiredEvidenceRefs: ['development-proposal-decision:1', 'graceful_shutdown:shutdown-1'],
    executionMode: ROLLBACK_EXECUTION_MODE.AUTOMATIC,
    preflightStatus: ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
    createdAt: '2026-04-24T17:41:10.000Z',
  });
  assert.deepEqual(rollbackConflict, {
    accepted: false,
    reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
  });

  await store.startDeployAttempt({
    deployAttemptId: 'deploy-attempt:1',
    releaseRequestId: 'release-request:1',
    rollbackPlanId: 'rollback-plan:1',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    deploymentIdentity: 'deployment:local:1',
    migrationState: 'schema:022',
    evidenceStorageWritable: true,
    startedAt: '2026-04-24T17:41:30.000Z',
  });
  const deployConflict = await store.startDeployAttempt({
    deployAttemptId: 'deploy-attempt:1',
    releaseRequestId: 'release-request:1',
    rollbackPlanId: 'rollback-plan:1',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    deploymentIdentity: 'deployment:local:other',
    migrationState: 'schema:022',
    evidenceStorageWritable: true,
    startedAt: '2026-04-24T17:41:31.000Z',
  });

  assert.deepEqual(deployConflict, {
    accepted: false,
    reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
  });
});

void test('AC-F0026-05 AC-F0026-10 records evidence bundles and rollback executions as release-owned facts', async () => {
  const harness = createReleaseAutomationDbHarness();
  const store = createReleaseAutomationStore(harness.db);
  await store.createReleaseRequest(createRequestInput());
  await store.createRollbackPlan({
    rollbackPlanId: 'rollback-plan:1',
    releaseRequestId: 'release-request:1',
    rollbackTargetRef: 'git:stable',
    requiredEvidenceRefs: ['development-proposal-decision:1', 'graceful_shutdown:shutdown-1'],
    executionMode: ROLLBACK_EXECUTION_MODE.AUTOMATIC,
    preflightStatus: ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
    createdAt: '2026-04-24T17:42:00.000Z',
  });
  await store.startDeployAttempt({
    deployAttemptId: 'deploy-attempt:1',
    releaseRequestId: 'release-request:1',
    rollbackPlanId: 'rollback-plan:1',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    deploymentIdentity: 'deployment:local:1',
    migrationState: 'schema:022',
    evidenceStorageWritable: true,
    startedAt: '2026-04-24T17:42:10.000Z',
  });
  await store.completeDeployAttempt({
    deployAttemptId: 'deploy-attempt:1',
    status: DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED,
    failureReason: 'smoke failed',
    finishedAt: '2026-04-24T17:42:20.000Z',
  });
  const evidenceInput: ReleaseEvidenceBundle = {
    evidenceBundleId: 'release-evidence:1',
    releaseRequestId: 'release-request:1',
    deployAttemptId: 'deploy-attempt:1',
    commitRef: 'git:main',
    deploymentIdentity: 'deployment:local:1',
    migrationState: 'schema:022',
    smokeOnDeployResult: {
      status: RELEASE_SMOKE_STATUS.FAILED,
      command: 'pnpm smoke:cell',
      startedAt: '2026-04-24T17:42:10.000Z',
      finishedAt: '2026-04-24T17:42:20.000Z',
      exitCode: 1,
      evidenceRef: 'file:smoke:1',
    },
    modelServingReadinessRef: 'model_profile_health:code.deep@shared',
    governorEvidenceRef: 'development-proposal-decision:1',
    lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
    diagnosticReportRefs: ['report-run:development'],
    fileArtifactRefs: ['file:release-evidence:1'],
    materializedAt: '2026-04-24T17:42:21.000Z',
  };
  const firstEvidence = await store.recordReleaseEvidence(evidenceInput);
  const evidenceConflict = await store.recordReleaseEvidence({
    ...evidenceInput,
    smokeOnDeployResult: {
      ...evidenceInput.smokeOnDeployResult,
      command: 'pnpm smoke:cell --other',
    },
  });
  const rollbackInput: RollbackExecution = {
    rollbackExecutionId: 'rollback-execution:1',
    rollbackPlanId: 'rollback-plan:1',
    deployAttemptId: 'deploy-attempt:1',
    trigger: ROLLBACK_EXECUTION_TRIGGER.AUTO_SMOKE_FAILURE,
    status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
    evidenceRefs: ['rollback:evidence:1'],
    diagnosticReportRefs: ['report-run:development'],
    executedAt: '2026-04-24T17:42:30.000Z',
    failureReason: null,
  };
  const firstRollback = await store.recordRollbackExecution(rollbackInput);
  const rollbackConflict = await store.recordRollbackExecution({
    ...rollbackInput,
    status: ROLLBACK_EXECUTION_STATUS.FAILED,
    failureReason: 'rollback command failed',
  });
  const rollbackScopeConflict = await store.recordRollbackExecution({
    ...rollbackInput,
    rollbackExecutionId: 'rollback-execution:other',
    trigger: ROLLBACK_EXECUTION_TRIGGER.CI_MANUAL,
  });

  const inspection = await store.inspectReleaseRequest('release-request:1');

  assert.equal(firstEvidence.accepted, true);
  assert.deepEqual(evidenceConflict, {
    accepted: false,
    reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    existingBundle: evidenceInput,
  });
  assert.equal(firstRollback.accepted, true);
  assert.deepEqual(rollbackConflict, {
    accepted: false,
    reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    existingExecution: rollbackInput,
  });
  assert.deepEqual(rollbackScopeConflict, {
    accepted: false,
    reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    existingExecution: rollbackInput,
  });
  assert.equal(inspection?.request.requestId, 'release-request:1');
  assert.equal(inspection?.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED);
  assert.equal(
    inspection?.evidenceBundles[0]?.governorEvidenceRef,
    'development-proposal-decision:1',
  );
  assert.equal(inspection?.rollbackExecutions[0]?.trigger, 'auto_smoke_failure');
});

void test('AC-F0026-12 AC-F0026-14 AC-F0026-15 rejects neighboring owner write surfaces', () => {
  const store = createReleaseAutomationStore(createReleaseAutomationDbHarness().db);

  assert.throws(
    () => store.assertOwnedWriteSurface(RELEASE_AUTOMATION_FOREIGN_WRITE_SURFACE.REPORT_RUNS),
    /foreign_owner_write_rejected/,
  );
});
