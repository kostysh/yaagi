import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_AUTOMATION_REJECTION_REASON,
  RELEASE_REQUEST_SOURCE,
  RELEASE_SMOKE_STATUS,
  RELEASE_TARGET_ENVIRONMENT,
  ROLLBACK_EXECUTION_STATUS,
  ROLLBACK_EXECUTION_TRIGGER,
} from '@yaagi/contracts/release-automation';
import {
  createCanonicalFormatReleasePrerequisiteValidator,
  createReleaseAutomationService,
  type ReleaseAutomationSmokeResult,
} from '../../src/platform/release-automation.ts';
import { createInMemoryReleaseAutomationStore } from '../../testing/release-automation-fixture.ts';

void test('AC-F0026-09 AC-F0026-10 automatically rolls back on failed smoke-on-deploy', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-rollback-'));
  const { store } = createInMemoryReleaseAutomationStore();
  let rollbackCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.FAILED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:05:00.000Z',
        finishedAt: '2026-04-24T18:06:00.000Z',
        exitCode: 1,
        evidenceRef: 'file:smoke:failed',
      }),
    rollbackExecutor: ({ rollbackPlan }) => {
      rollbackCalls += 1;
      return Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: [`rollback:executed:${rollbackPlan.rollbackTargetRef}`],
        failureReason: null,
      });
    },
    now: () => '2026-04-24T18:06:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:rollback',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:05:00.000Z',
    });

    const result = await service.runDeployAttempt({ requestId: 'release-request:rollback' });

    assert.equal(result.accepted, true);
    if (!result.accepted) {
      return;
    }
    assert.equal(rollbackCalls, 1);
    assert.equal(result.deployAttempt.status, DEPLOY_ATTEMPT_STATUS.ROLLED_BACK);
    assert.equal(result.rollbackExecution?.status, ROLLBACK_EXECUTION_STATUS.SUCCEEDED);
    assert.equal(result.rollbackExecution?.trigger, 'auto_smoke_failure');
    assert.equal(result.evidenceBundle.smokeOnDeployResult.status, RELEASE_SMOKE_STATUS.FAILED);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-03 AC-F0026-09 replays deploy attempt without repeating smoke or rollback side effects', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-replay-'));
  const { store } = createInMemoryReleaseAutomationStore();
  let smokeCalls = 0;
  let rollbackCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () => {
      smokeCalls += 1;
      return Promise.resolve({
        status: RELEASE_SMOKE_STATUS.FAILED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:07:00.000Z',
        finishedAt: '2026-04-24T18:08:00.000Z',
        exitCode: 1,
        evidenceRef: 'file:smoke:failed',
      });
    },
    rollbackExecutor: () => {
      rollbackCalls += 1;
      return Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: ['rollback:executed:stable'],
        failureReason: null,
      });
    },
    now: () => '2026-04-24T18:08:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:replay',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:07:00.000Z',
    });

    const first = await service.runDeployAttempt({
      requestId: 'release-request:replay',
      deployAttemptId: 'deploy-attempt:replay',
    });
    const replay = await service.runDeployAttempt({
      requestId: 'release-request:replay',
      deployAttemptId: 'deploy-attempt:replay',
    });

    assert.equal(first.accepted, true);
    assert.equal(replay.accepted, true);
    assert.equal(smokeCalls, 1);
    assert.equal(rollbackCalls, 1);
    if (first.accepted && replay.accepted) {
      assert.equal(first.deployAttempt.deployAttemptId, replay.deployAttempt.deployAttemptId);
      assert.equal(first.evidenceBundle.evidenceBundleId, replay.evidenceBundle.evidenceBundleId);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-03 replays the default deploy attempt id and identity deterministically', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-default-replay-'));
  const { store } = createInMemoryReleaseAutomationStore();
  let smokeCalls = 0;
  const timestamps = [
    '2026-04-24T18:09:00.000Z',
    '2026-04-24T18:09:01.000Z',
    '2026-04-24T18:09:02.000Z',
    '2026-04-24T18:09:03.000Z',
  ];
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () => {
      smokeCalls += 1;
      return Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:09:00.000Z',
        finishedAt: '2026-04-24T18:10:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      });
    },
    now: () => timestamps.shift() ?? '2026-04-24T18:09:59.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:default-replay',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:09:00.000Z',
    });

    const first = await service.runDeployAttempt({ requestId: 'release-request:default-replay' });
    const replay = await service.runDeployAttempt({ requestId: 'release-request:default-replay' });

    assert.equal(first.accepted, true);
    assert.equal(replay.accepted, true);
    assert.equal(smokeCalls, 1);
    if (first.accepted && replay.accepted) {
      assert.equal(first.deployAttempt.deployAttemptId, replay.deployAttempt.deployAttemptId);
      assert.equal(first.deployAttempt.deploymentIdentity, replay.deployAttempt.deploymentIdentity);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-05 records the actual smoke runner command in release evidence', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-smoke-command-evidence-'));
  const { store } = createInMemoryReleaseAutomationStore();
  let smokeCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () => {
      smokeCalls += 1;
      return Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell --actual',
        startedAt: '2026-04-24T18:11:00.000Z',
        finishedAt: '2026-04-24T18:12:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      });
    },
    now: () => '2026-04-24T18:12:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:smoke-command-evidence',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:11:00.000Z',
    });

    const result = await service.runDeployAttempt({
      requestId: 'release-request:smoke-command-evidence',
      deployAttemptId: 'deploy-attempt:smoke-command-evidence',
    });

    assert.equal(result.accepted, true);
    if (result.accepted) {
      assert.equal(result.evidenceBundle.smokeOnDeployResult.command, 'pnpm smoke:cell --actual');
    }
    assert.equal(smokeCalls, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-03 finalizes a replay when evidence exists but deploy status is still running', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-running-replay-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  let smokeCalls = 0;
  let completeCalls = 0;
  const completeDeployAttempt = store.completeDeployAttempt.bind(store);
  store.completeDeployAttempt = (input) => {
    completeCalls += 1;
    if (completeCalls === 1) {
      return Promise.resolve(null);
    }
    return completeDeployAttempt(input);
  };
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () => {
      smokeCalls += 1;
      return Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:12:30.000Z',
        finishedAt: '2026-04-24T18:13:30.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      });
    },
    now: () => '2026-04-24T18:13:31.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:running-replay',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:12:30.000Z',
    });

    const first = await service.runDeployAttempt({
      requestId: 'release-request:running-replay',
      deployAttemptId: 'deploy-attempt:running-replay',
    });
    assert.deepEqual(first, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    });
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.RUNNING);

    const replayService = createReleaseAutomationService({
      store,
      evidenceRootPath: path.join(root, 'not-needed-for-replay'),
      prerequisiteValidator: () =>
        Promise.resolve({
          accepted: false as const,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE,
        }),
      smokeRunner: null,
      now: () => '2026-04-24T18:13:32.000Z',
    });
    const replay = await replayService.runDeployAttempt({
      requestId: 'release-request:running-replay',
      deployAttemptId: 'deploy-attempt:running-replay',
    });

    assert.equal(replay.accepted, true);
    if (replay.accepted) {
      assert.equal(replay.deployAttempt.status, DEPLOY_ATTEMPT_STATUS.SUCCEEDED);
    }
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.SUCCEEDED);
    assert.equal(smokeCalls, 1);
    assert.equal(completeCalls, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-11 terminally fails deploy attempt when smoke runner throws after start', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-smoke-throw-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () => Promise.reject(new Error('smoke runner crashed')),
    now: () => '2026-04-24T18:12:45.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:smoke-throw',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:12:40.000Z',
    });

    const result = await service.runDeployAttempt({
      requestId: 'release-request:smoke-throw',
      deployAttemptId: 'deploy-attempt:smoke-throw',
    });

    assert.equal(result.accepted, true);
    if (result.accepted) {
      assert.equal(result.deployAttempt.status, DEPLOY_ATTEMPT_STATUS.FAILED);
      assert.equal(
        result.deployAttempt.failureReason,
        RELEASE_AUTOMATION_REJECTION_REASON.SMOKE_HARNESS_UNAVAILABLE,
      );
      assert.equal(
        result.evidenceBundle.smokeOnDeployResult.status,
        RELEASE_SMOKE_STATUS.UNAVAILABLE,
      );
    }
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.FAILED);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-03 rejects replay of running deploy attempt without evidence without terminal overwrite', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-running-no-evidence-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  let smokeCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () => {
      smokeCalls += 1;
      return Promise.reject(new Error('first run crashed'));
    },
    now: () => '2026-04-24T18:12:50.000Z',
  });

  try {
    const prepared = await service.prepareRelease({
      requestId: 'release-request:running-no-evidence',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:12:50.000Z',
    });
    assert.equal(prepared.accepted, true);
    if (!prepared.accepted) {
      return;
    }

    const started = await store.startDeployAttempt({
      deployAttemptId: 'deploy-attempt:running-no-evidence',
      releaseRequestId: 'release-request:running-no-evidence',
      rollbackPlanId: prepared.rollbackPlan.rollbackPlanId,
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      deploymentIdentity: 'local:running-no-evidence',
      migrationState: 'schema:latest',
      evidenceStorageWritable: true,
      startedAt: '2026-04-24T18:12:51.000Z',
    });
    assert.equal(started.accepted, true);

    const replay = await service.runDeployAttempt({
      requestId: 'release-request:running-no-evidence',
      deployAttemptId: 'deploy-attempt:running-no-evidence',
      deploymentIdentity: 'local:running-no-evidence',
    });

    assert.deepEqual(replay, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    });
    assert.equal(smokeCalls, 0);
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.RUNNING);
    assert.equal(state.deployAttempts[0]?.failureReason, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-03 concurrent replay does not terminally fail a live deploy attempt', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-live-replay-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  let resolveSmoke: (result: ReleaseAutomationSmokeResult) => void = () => {
    throw new Error('smoke resolver not initialized');
  };
  const smokePromise = new Promise<ReleaseAutomationSmokeResult>((resolve) => {
    resolveSmoke = resolve;
  });
  let smokeCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () => {
      smokeCalls += 1;
      return smokePromise;
    },
    now: () => '2026-04-24T18:12:55.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:live-replay',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:12:55.000Z',
    });

    const first = service.runDeployAttempt({
      requestId: 'release-request:live-replay',
      deployAttemptId: 'deploy-attempt:live-replay',
    });
    while (smokeCalls === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.RUNNING);

    const replay = await service.runDeployAttempt({
      requestId: 'release-request:live-replay',
      deployAttemptId: 'deploy-attempt:live-replay',
    });
    assert.deepEqual(replay, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    });
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.RUNNING);

    resolveSmoke({
      status: RELEASE_SMOKE_STATUS.PASSED,
      command: 'pnpm smoke:cell',
      startedAt: '2026-04-24T18:12:55.000Z',
      finishedAt: '2026-04-24T18:13:55.000Z',
      exitCode: 0,
      evidenceRef: 'file:smoke:passed',
    });

    const completed = await first;
    assert.equal(completed.accepted, true);
    if (completed.accepted) {
      assert.equal(completed.deployAttempt.status, DEPLOY_ATTEMPT_STATUS.SUCCEEDED);
    }
    assert.equal(smokeCalls, 1);
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.SUCCEEDED);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-05 terminally fails deploy attempt when evidence persistence conflicts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-evidence-conflict-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  let completeCalls = 0;
  const completeDeployAttempt = store.completeDeployAttempt.bind(store);
  store.completeDeployAttempt = (input) => {
    completeCalls += 1;
    return completeDeployAttempt(input);
  };
  store.recordReleaseEvidence = (input) =>
    Promise.resolve({
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
      existingBundle: input,
    });
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:13:00.000Z',
        finishedAt: '2026-04-24T18:14:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      }),
    now: () => '2026-04-24T18:14:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:evidence-conflict',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:13:00.000Z',
    });

    const result = await service.runDeployAttempt({
      requestId: 'release-request:evidence-conflict',
    });

    assert.deepEqual(result, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    });
    assert.equal(completeCalls, 1);
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.FAILED);
    assert.equal(state.deployAttempts[0]?.failureReason, 'release_evidence_conflict');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-05 terminally fails deploy attempt when evidence persistence throws', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-evidence-throw-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  let completeCalls = 0;
  const completeDeployAttempt = store.completeDeployAttempt.bind(store);
  store.completeDeployAttempt = (input) => {
    completeCalls += 1;
    return completeDeployAttempt(input);
  };
  store.recordReleaseEvidence = () => Promise.reject(new Error('db unavailable'));
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:14:10.000Z',
        finishedAt: '2026-04-24T18:15:10.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      }),
    now: () => '2026-04-24T18:15:11.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:evidence-throw',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:14:10.000Z',
    });

    const result = await service.runDeployAttempt({
      requestId: 'release-request:evidence-throw',
    });

    assert.deepEqual(result, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    });
    assert.equal(completeCalls, 1);
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.FAILED);
    assert.equal(state.deployAttempts[0]?.failureReason, 'release_evidence_persistence_failed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-10 records critical rollback-failure evidence when rollback persistence conflicts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-rollback-conflict-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  let completeCalls = 0;
  const completeDeployAttempt = store.completeDeployAttempt.bind(store);
  store.completeDeployAttempt = (input) => {
    completeCalls += 1;
    return completeDeployAttempt(input);
  };
  store.recordRollbackExecution = (input) =>
    Promise.resolve({
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
      existingExecution: {
        ...input,
        trigger: ROLLBACK_EXECUTION_TRIGGER.OPERATOR_MANUAL,
      },
    });
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.FAILED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:15:00.000Z',
        finishedAt: '2026-04-24T18:16:00.000Z',
        exitCode: 1,
        evidenceRef: 'file:smoke:failed',
      }),
    rollbackExecutor: () =>
      Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: ['rollback:executed:stable'],
        failureReason: null,
      }),
    now: () => '2026-04-24T18:16:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:rollback-conflict',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:15:00.000Z',
    });

    const result = await service.runDeployAttempt({
      requestId: 'release-request:rollback-conflict',
    });

    assert.equal(result.accepted, true);
    if (result.accepted) {
      assert.equal(result.deployAttempt.status, DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED);
      assert.equal(
        result.deployAttempt.failureReason,
        `critical_rollback_failure:${RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT}`,
      );
      assert.equal(result.rollbackExecution, null);
      assert.match(
        result.evidenceBundle.fileArtifactRefs.join('\n'),
        /^critical-rollback-failure:/m,
      );
    }
    assert.equal(completeCalls, 1);
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-10 terminally fails deploy attempt when rollback reservation persistence throws', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-rollback-store-throw-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  let completeCalls = 0;
  const completeDeployAttempt = store.completeDeployAttempt.bind(store);
  store.completeDeployAttempt = (input) => {
    completeCalls += 1;
    return completeDeployAttempt(input);
  };
  let rollbackCalls = 0;
  store.recordRollbackExecution = () => Promise.reject(new Error('rollback store unavailable'));
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.FAILED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:17:00.000Z',
        finishedAt: '2026-04-24T18:18:00.000Z',
        exitCode: 1,
        evidenceRef: 'file:smoke:failed',
      }),
    rollbackExecutor: () => {
      rollbackCalls += 1;
      return Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: ['rollback:should-not-run'],
        failureReason: null,
      });
    },
    now: () => '2026-04-24T18:18:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:rollback-store-throw',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:17:00.000Z',
    });

    const result = await service.runDeployAttempt({
      requestId: 'release-request:rollback-store-throw',
    });

    assert.equal(result.accepted, true);
    if (result.accepted) {
      assert.equal(result.deployAttempt.status, DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED);
      assert.equal(
        result.deployAttempt.failureReason,
        `critical_rollback_failure:${RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT}`,
      );
      assert.equal(result.rollbackExecution, null);
      assert.match(
        result.evidenceBundle.fileArtifactRefs.join('\n'),
        /^critical-rollback-failure:/m,
      );
    }
    assert.equal(rollbackCalls, 0);
    assert.equal(completeCalls, 1);
    assert.equal(state.deployAttempts[0]?.status, DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
