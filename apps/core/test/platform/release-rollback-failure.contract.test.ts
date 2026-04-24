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
} from '@yaagi/contracts/release-automation';
import {
  createCanonicalFormatReleasePrerequisiteValidator,
  createReleaseAutomationService,
} from '../../src/platform/release-automation.ts';
import { createInMemoryReleaseAutomationStore } from '../../testing/release-automation-fixture.ts';

void test('AC-F0026-10 records critical rollback-failure evidence when rollback cannot execute', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-rollback-failure-'));
  const { store } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.FAILED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:10:00.000Z',
        finishedAt: '2026-04-24T18:11:00.000Z',
        exitCode: 1,
        evidenceRef: 'file:smoke:failed',
      }),
    now: () => '2026-04-24T18:11:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:rollback-failure',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:10:00.000Z',
    });

    const result = await service.runDeployAttempt({
      requestId: 'release-request:rollback-failure',
    });

    assert.equal(result.accepted, true);
    if (!result.accepted) {
      return;
    }
    assert.equal(result.deployAttempt.status, DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED);
    assert.equal(result.rollbackExecution?.status, ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE);
    assert.equal(
      result.rollbackExecution?.failureReason,
      RELEASE_AUTOMATION_REJECTION_REASON.ROLLBACK_EXECUTOR_UNAVAILABLE,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-09 rejects manual rollback when rollback plan belongs to another release', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-rollback-mismatch-'));
  const { store } = createInMemoryReleaseAutomationStore();
  let rollbackCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:12:00.000Z',
        finishedAt: '2026-04-24T18:13:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      }),
    rollbackExecutor: () => {
      rollbackCalls += 1;
      return Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: ['rollback:should-not-run'],
        failureReason: null,
      });
    },
    now: () => '2026-04-24T18:13:01.000Z',
  });

  try {
    const firstPrepare = await service.prepareRelease({
      requestId: 'release-request:manual-rollback-a',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable-a',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:12:00.000Z',
    });
    const secondPrepare = await service.prepareRelease({
      requestId: 'release-request:manual-rollback-b',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:other',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable-b',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:12:05.000Z',
    });
    assert.equal(firstPrepare.accepted, true);
    assert.equal(secondPrepare.accepted, true);
    if (!firstPrepare.accepted || !secondPrepare.accepted) {
      return;
    }

    const deploy = await service.runDeployAttempt({
      requestId: 'release-request:manual-rollback-a',
      deployAttemptId: 'deploy-attempt:manual-rollback-a',
    });
    assert.equal(deploy.accepted, true);

    const rollback = await service.executeRollback({
      requestId: 'release-request:manual-rollback-a',
      deployAttemptId: 'deploy-attempt:manual-rollback-a',
      rollbackPlanId: secondPrepare.rollbackPlan.rollbackPlanId,
      trigger: 'ci_manual',
    });

    assert.deepEqual(rollback, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN,
    });
    assert.equal(rollbackCalls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-10 replays manual rollback without repeating rollback executor side effects', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-manual-rollback-replay-'));
  const { store } = createInMemoryReleaseAutomationStore();
  let rollbackCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:14:00.000Z',
        finishedAt: '2026-04-24T18:15:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      }),
    rollbackExecutor: () => {
      rollbackCalls += 1;
      return Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: ['rollback:manual:executed'],
        failureReason: null,
      });
    },
    now: () => '2026-04-24T18:15:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:manual-rollback-replay',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:14:00.000Z',
    });

    const deploy = await service.runDeployAttempt({
      requestId: 'release-request:manual-rollback-replay',
      deployAttemptId: 'deploy-attempt:manual-rollback-replay',
    });
    assert.equal(deploy.accepted, true);

    const input = {
      requestId: 'release-request:manual-rollback-replay',
      deployAttemptId: 'deploy-attempt:manual-rollback-replay',
      trigger: 'operator_manual' as const,
    };
    const first = await service.executeRollback(input);
    const replay = await service.executeRollback(input);

    assert.equal(first.accepted, true);
    assert.equal(replay.accepted, true);
    assert.equal(rollbackCalls, 1);
    if (first.accepted && replay.accepted) {
      assert.equal(
        first.rollbackExecution.rollbackExecutionId,
        replay.rollbackExecution.rollbackExecutionId,
      );
      assert.equal(replay.rollbackExecution.status, ROLLBACK_EXECUTION_STATUS.SUCCEEDED);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-10 rejects trigger drift without repeating rollback executor side effects', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-manual-rollback-trigger-'));
  const { store } = createInMemoryReleaseAutomationStore();
  let rollbackCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:15:00.000Z',
        finishedAt: '2026-04-24T18:16:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      }),
    rollbackExecutor: () => {
      rollbackCalls += 1;
      return Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: ['rollback:manual:executed'],
        failureReason: null,
      });
    },
    now: () => '2026-04-24T18:16:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:manual-rollback-trigger',
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

    const deploy = await service.runDeployAttempt({
      requestId: 'release-request:manual-rollback-trigger',
      deployAttemptId: 'deploy-attempt:manual-rollback-trigger',
    });
    assert.equal(deploy.accepted, true);

    const first = await service.executeRollback({
      requestId: 'release-request:manual-rollback-trigger',
      deployAttemptId: 'deploy-attempt:manual-rollback-trigger',
      trigger: 'operator_manual',
    });
    const drift = await service.executeRollback({
      requestId: 'release-request:manual-rollback-trigger',
      deployAttemptId: 'deploy-attempt:manual-rollback-trigger',
      trigger: 'ci_manual',
    });

    assert.equal(first.accepted, true);
    assert.deepEqual(drift, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    });
    assert.equal(rollbackCalls, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-10 rollback reservation terminally fails closed after terminal write failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-rollback-reservation-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  const completeRollbackExecution = store.completeRollbackExecution.bind(store);
  let failNextCompletion = true;
  store.completeRollbackExecution = (input) => {
    if (failNextCompletion) {
      failNextCompletion = false;
      return Promise.reject(new Error('terminal rollback write failed'));
    }
    return completeRollbackExecution(input);
  };
  let rollbackCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:16:00.000Z',
        finishedAt: '2026-04-24T18:17:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      }),
    rollbackExecutor: () => {
      rollbackCalls += 1;
      return Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: ['rollback:manual:executed'],
        failureReason: null,
      });
    },
    now: () => '2026-04-24T18:17:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:manual-rollback-reservation',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:16:00.000Z',
    });

    const deploy = await service.runDeployAttempt({
      requestId: 'release-request:manual-rollback-reservation',
      deployAttemptId: 'deploy-attempt:manual-rollback-reservation',
    });
    assert.equal(deploy.accepted, true);

    const input = {
      requestId: 'release-request:manual-rollback-reservation',
      deployAttemptId: 'deploy-attempt:manual-rollback-reservation',
      trigger: 'operator_manual' as const,
    };
    const first = await service.executeRollback(input);
    const replay = await service.executeRollback(input);

    assert.equal(rollbackCalls, 1);
    assert.equal(first.accepted, true);
    if (first.accepted) {
      assert.equal(first.rollbackExecution.status, ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE);
      assert.equal(first.rollbackExecution.failureReason, 'rollback_terminal_write_failed');
    }
    assert.equal(state.rollbackExecutions[0]?.status, ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE);
    assert.equal(replay.accepted, true);
    if (replay.accepted) {
      assert.equal(replay.rollbackExecution.status, ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-10 rollback reservation terminally fails closed after terminal write conflict', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-rollback-conflict-running-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  const completeRollbackExecution = store.completeRollbackExecution.bind(store);
  let failNextCompletion = true;
  store.completeRollbackExecution = (input) => {
    if (failNextCompletion) {
      failNextCompletion = false;
      const existingExecution =
        state.rollbackExecutions.find(
          (execution) => execution.rollbackExecutionId === input.rollbackExecutionId,
        ) ?? input;
      return Promise.resolve({
        accepted: false,
        reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
        existingExecution,
      });
    }
    return completeRollbackExecution(input);
  };
  let rollbackCalls = 0;
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:18:00.000Z',
        finishedAt: '2026-04-24T18:19:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      }),
    rollbackExecutor: () => {
      rollbackCalls += 1;
      return Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: ['rollback:manual:executed'],
        failureReason: null,
      });
    },
    now: () => '2026-04-24T18:19:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:manual-rollback-conflict-running',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:18:00.000Z',
    });

    const deploy = await service.runDeployAttempt({
      requestId: 'release-request:manual-rollback-conflict-running',
      deployAttemptId: 'deploy-attempt:manual-rollback-conflict-running',
    });
    assert.equal(deploy.accepted, true);

    const rollback = await service.executeRollback({
      requestId: 'release-request:manual-rollback-conflict-running',
      deployAttemptId: 'deploy-attempt:manual-rollback-conflict-running',
      trigger: 'operator_manual',
    });

    assert.equal(rollbackCalls, 1);
    assert.equal(rollback.accepted, true);
    if (rollback.accepted) {
      assert.equal(rollback.rollbackExecution.status, ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE);
      assert.equal(
        rollback.rollbackExecution.failureReason,
        'rollback_terminal_write_conflict_found_running',
      );
    }
    assert.equal(state.rollbackExecutions[0]?.status, ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
