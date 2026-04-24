import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  RELEASE_REQUEST_SOURCE,
  RELEASE_REQUESTED_ACTION,
  RELEASE_SMOKE_STATUS,
  RELEASE_TARGET_ENVIRONMENT,
  ROLLBACK_EXECUTION_MODE,
  ROLLBACK_EXECUTION_STATUS,
  ROLLBACK_EXECUTION_TRIGGER,
  ROLLBACK_PLAN_PREFLIGHT_STATUS,
  type ReleaseInspection,
} from '@yaagi/contracts/release-automation';
import {
  createCanonicalFormatReleasePrerequisiteValidator,
  createReleaseAutomationService,
} from '../../src/platform/release-automation.ts';
import type {
  ExecuteReleaseRollbackInput,
  PrepareReleaseInput,
  RunReleaseDeployAttemptInput,
} from '../../src/platform/release-automation.ts';
import { createInMemoryReleaseAutomationStore } from '../../testing/release-automation-fixture.ts';
import {
  createOperatorAuthHeaders,
  createPlatformTestRuntime,
} from '../../testing/platform-test-fixture.ts';

// Coverage refs: AC-F0026-02 AC-F0026-07 AC-F0026-08 AC-F0026-13

void test('AC-F0026-07 AC-F0026-08 forwards admitted release prepare through the shared service seam', async () => {
  const prepareInputs: PrepareReleaseInput[] = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        prepareRelease: (input) => {
          prepareInputs.push(input);
          return Promise.resolve({
            accepted: true,
            request: {
              requestId: input.requestId,
              normalizedRequestHash: 'hash:operator',
              targetEnvironment: input.targetEnvironment,
              gitRef: input.gitRef,
              rollbackTargetRef: input.rollbackTargetRef,
              actorRef: input.actorRef,
              source: input.source,
              requestedAction: RELEASE_REQUESTED_ACTION.DEPLOY,
              evidenceRefs: input.evidenceRefs ?? [],
              requestedAt: input.requestedAt ?? '2026-04-24T18:20:00.000Z',
              createdAt: input.requestedAt ?? '2026-04-24T18:20:00.000Z',
            },
            rollbackPlan: {
              rollbackPlanId: 'rollback-plan:operator',
              releaseRequestId: input.requestId,
              deployAttemptId: null,
              rollbackTargetRef: input.rollbackTargetRef,
              requiredEvidenceRefs: [
                input.governorEvidenceRef,
                input.lifecycleRollbackTargetRef,
                input.modelServingReadinessRef,
              ],
              executionMode: ROLLBACK_EXECUTION_MODE.AUTOMATIC,
              preflightStatus: ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
              createdAt: input.requestedAt ?? '2026-04-24T18:20:00.000Z',
            },
            requestDeduplicated: false,
            rollbackPlanDeduplicated: false,
          });
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/releases', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
          'x-request-id': 'http-request-release-prepare-1',
        }),
        body: JSON.stringify({
          requestId: 'release-request:operator',
          targetEnvironment: 'release_cell',
          gitRef: 'git:main',
          rollbackTargetRef: 'git:stable',
          governorEvidenceRef: 'development-proposal-decision:1',
          lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
          modelServingReadinessRef: 'model_profile_health:code.deep@shared',
          diagnosticReportRefs: ['report-run:development'],
          evidenceRefs: ['operator:evidence:request'],
        }),
      }),
    );

    assert.equal(response.status, 202);
    assert.equal(((await response.json()) as { accepted: boolean }).accepted, true);
    assert.equal(prepareInputs.length, 1);
    assert.equal(prepareInputs[0]?.requestId, 'release-request:operator');
    assert.equal(prepareInputs[0]?.targetEnvironment, RELEASE_TARGET_ENVIRONMENT.RELEASE_CELL);
    assert.equal(prepareInputs[0]?.source, RELEASE_REQUEST_SOURCE.OPERATOR_API);
    assert.equal(prepareInputs[0]?.actorRef, 'operator:test-release');
    assert.deepEqual(prepareInputs[0]?.diagnosticReportRefs, ['report-run:development']);
    assert.equal(prepareInputs[0]?.evidenceRefs?.[0], 'operator:evidence:request');
    assert.match(prepareInputs[0]?.evidenceRefs?.[1] ?? '', /^operator-auth-evidence:/);
  } finally {
    await cleanup();
  }
});

void test('AC-F0026-03 AC-F0026-08 replays equivalent operator release prepare despite distinct admission request ids', async () => {
  const { store } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: '/tmp/yaagi-release-operator-replay',
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: null,
    now: () => '2026-04-24T18:20:00.000Z',
  });
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        prepareRelease: (input) => service.prepareRelease(input),
      }),
    },
  });
  const body = JSON.stringify({
    requestId: 'release-request:operator-replay',
    targetEnvironment: 'release_cell',
    gitRef: 'git:main',
    rollbackTargetRef: 'git:stable',
    governorEvidenceRef: 'development-proposal-decision:1',
    lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
    modelServingReadinessRef: 'model_profile_health:code.deep@shared',
    diagnosticReportRefs: ['report-run:development'],
    evidenceRefs: ['operator:evidence:request'],
  });

  try {
    const first = await runtime.fetch(
      new Request('http://yaagi/control/releases', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
          'x-request-id': 'http-request-release-prepare-replay-1',
        }),
        body,
      }),
    );
    const replay = await runtime.fetch(
      new Request('http://yaagi/control/releases', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
          'x-request-id': 'http-request-release-prepare-replay-2',
        }),
        body,
      }),
    );
    const firstBody = (await first.json()) as { accepted: boolean; requestDeduplicated?: boolean };
    const replayBody = (await replay.json()) as {
      accepted: boolean;
      requestDeduplicated?: boolean;
    };

    assert.equal(first.status, 202);
    assert.equal(replay.status, 202);
    assert.equal(firstBody.accepted, true);
    assert.equal(replayBody.accepted, true);
    assert.equal(firstBody.requestDeduplicated, false);
    assert.equal(replayBody.requestDeduplicated, true);
  } finally {
    await cleanup();
  }
});

void test('AC-F0026-07 routes deploy, rollback and inspection actions to the release service', async () => {
  const deployInputs: RunReleaseDeployAttemptInput[] = [];
  const rollbackInputs: ExecuteReleaseRollbackInput[] = [];
  const inspectedRequestIds: string[] = [];
  const inspection: ReleaseInspection = {
    request: {
      requestId: 'release-request:operator',
      normalizedRequestHash: 'hash:operator',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      rollbackTargetRef: 'git:stable',
      actorRef: 'operator:test-release',
      source: RELEASE_REQUEST_SOURCE.OPERATOR_API,
      requestedAction: RELEASE_REQUESTED_ACTION.DEPLOY,
      evidenceRefs: ['operator:evidence:request'],
      requestedAt: '2026-04-24T18:20:00.000Z',
      createdAt: '2026-04-24T18:20:00.000Z',
    },
    rollbackPlan: null,
    deployAttempts: [],
    evidenceBundles: [],
    rollbackExecutions: [],
  };
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        inspectRelease: (requestId) => {
          inspectedRequestIds.push(requestId);
          return Promise.resolve(inspection);
        },
        runReleaseDeployAttempt: (input) => {
          deployInputs.push(input);
          return Promise.resolve({
            accepted: false,
            reason: 'smoke_harness_unavailable',
          });
        },
        executeReleaseRollback: (input) => {
          rollbackInputs.push(input);
          return Promise.resolve({
            accepted: true,
            rollbackExecution: {
              rollbackExecutionId: 'rollback-execution:operator',
              rollbackPlanId: 'rollback-plan:operator',
              deployAttemptId: input.deployAttemptId,
              trigger: input.trigger,
              status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
              evidenceRefs: ['rollback:evidence:1'],
              diagnosticReportRefs: [],
              executedAt: '2026-04-24T18:21:00.000Z',
              failureReason: null,
            },
          });
        },
      }),
    },
  });

  try {
    const inspectResponse = await runtime.fetch(
      new Request('http://yaagi/control/releases?requestId=release-request:operator', {
        headers: createOperatorAuthHeaders('release'),
      }),
    );
    const deployResponse = await runtime.fetch(
      new Request('http://yaagi/control/release-deploy-attempts', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'release-request:operator',
          deployAttemptId: 'deploy-attempt:operator',
          deploymentIdentity: 'local:operator',
        }),
      }),
    );
    const rollbackResponse = await runtime.fetch(
      new Request('http://yaagi/control/release-rollbacks', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'release-request:operator',
          deployAttemptId: 'deploy-attempt:operator',
          rollbackPlanId: 'rollback-plan:operator',
        }),
      }),
    );

    assert.equal(inspectResponse.status, 200);
    assert.equal(deployResponse.status, 503);
    assert.equal(rollbackResponse.status, 202);
    assert.deepEqual(inspectedRequestIds, ['release-request:operator']);
    assert.equal(deployInputs[0]?.deployAttemptId, 'deploy-attempt:operator');
    assert.equal(deployInputs[0]?.deploymentIdentity, 'local:operator');
    assert.equal(rollbackInputs[0]?.trigger, ROLLBACK_EXECUTION_TRIGGER.OPERATOR_MANUAL);
    assert.equal('rollbackExecutionId' in (rollbackInputs[0] ?? {}), false);
  } finally {
    await cleanup();
  }
});

void test('AC-F0026-10 replays identical operator rollback without x-request-id', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-operator-rollback-replay-'));
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
        startedAt: '2026-04-24T18:22:00.000Z',
        finishedAt: '2026-04-24T18:23:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      }),
    rollbackExecutor: () => {
      rollbackCalls += 1;
      return Promise.resolve({
        status: ROLLBACK_EXECUTION_STATUS.SUCCEEDED,
        evidenceRefs: ['rollback:operator:executed'],
        failureReason: null,
      });
    },
    now: () => '2026-04-24T18:23:01.000Z',
  });
  await service.prepareRelease({
    requestId: 'release-request:operator-rollback-replay',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    gitRef: 'git:main',
    actorRef: 'operator:release',
    source: RELEASE_REQUEST_SOURCE.OPERATOR_API,
    rollbackTargetRef: 'git:stable',
    governorEvidenceRef: 'development-proposal-decision:1',
    lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
    modelServingReadinessRef: 'model_profile_health:code.deep@shared',
    diagnosticReportRefs: ['report-run:development'],
    requestedAt: '2026-04-24T18:22:00.000Z',
  });
  await service.runDeployAttempt({
    requestId: 'release-request:operator-rollback-replay',
    deployAttemptId: 'deploy-attempt:operator-rollback-replay',
  });
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        executeReleaseRollback: (input) => service.executeRollback(input),
      }),
    },
  });
  const body = JSON.stringify({
    requestId: 'release-request:operator-rollback-replay',
    deployAttemptId: 'deploy-attempt:operator-rollback-replay',
  });

  try {
    const first = await runtime.fetch(
      new Request('http://yaagi/control/release-rollbacks', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
        }),
        body,
      }),
    );
    const replay = await runtime.fetch(
      new Request('http://yaagi/control/release-rollbacks', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
        }),
        body,
      }),
    );
    const firstBody = (await first.json()) as {
      accepted: boolean;
      rollbackExecution?: { rollbackExecutionId: string };
    };
    const replayBody = (await replay.json()) as {
      accepted: boolean;
      rollbackExecution?: { rollbackExecutionId: string };
    };

    assert.equal(first.status, 202);
    assert.equal(replay.status, 202);
    assert.equal(firstBody.accepted, true);
    assert.equal(replayBody.accepted, true);
    assert.equal(rollbackCalls, 1);
    assert.equal(
      firstBody.rollbackExecution?.rollbackExecutionId,
      replayBody.rollbackExecution?.rollbackExecutionId,
    );
  } finally {
    await cleanup();
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-08 rejects caller-controlled release deploy smoke command before service handoff', async () => {
  const deployInputs: RunReleaseDeployAttemptInput[] = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        runReleaseDeployAttempt: (input) => {
          deployInputs.push(input);
          return Promise.resolve({
            accepted: false,
            reason: 'smoke_harness_unavailable',
          });
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/release-deploy-attempts', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'release-request:operator',
          smokeCommand: 'pnpm test',
        }),
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(deployInputs.length, 0);
  } finally {
    await cleanup();
  }
});

void test('AC-F0026-08 rejects caller-controlled rollback trigger before service handoff', async () => {
  const rollbackInputs: ExecuteReleaseRollbackInput[] = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        executeReleaseRollback: (input) => {
          rollbackInputs.push(input);
          return Promise.resolve({
            accepted: false,
            reason: 'missing_rollback_plan',
          });
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/release-rollbacks', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'release-request:operator',
          deployAttemptId: 'deploy-attempt:operator',
          trigger: 'ci_manual',
        }),
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(rollbackInputs.length, 0);
  } finally {
    await cleanup();
  }
});

void test('AC-F0026-08 fails closed when the release owner seam is not registered', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        requestTick: () => Promise.resolve({ accepted: true }),
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/releases', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'release-request:missing-owner',
          targetEnvironment: 'local',
          gitRef: 'git:main',
          rollbackTargetRef: 'git:stable',
          governorEvidenceRef: 'development-proposal-decision:1',
          lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
          modelServingReadinessRef: 'model_profile_health:code.deep@shared',
        }),
      }),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      available: false,
      action: 'releases',
      owner: 'F-0026',
      reason: 'downstream_owner_unavailable',
    });
  } finally {
    await cleanup();
  }
});

void test('AC-F0026-08 maps release owner exceptions to unavailable instead of validation errors', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        prepareRelease: () => Promise.reject(new Error('postgres unavailable')),
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/releases', {
        method: 'POST',
        headers: createOperatorAuthHeaders('release', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'release-request:service-error',
          targetEnvironment: 'local',
          gitRef: 'git:main',
          rollbackTargetRef: 'git:stable',
          governorEvidenceRef: 'development-proposal-decision:1',
          lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
          modelServingReadinessRef: 'model_profile_health:code.deep@shared',
          diagnosticReportRefs: ['report-run:development'],
        }),
      }),
    );
    const body = (await response.json()) as {
      accepted: boolean;
      error: string;
      detail: string;
    };

    assert.equal(response.status, 503);
    assert.equal(body.accepted, false);
    assert.equal(body.error, 'release_owner_unavailable');
    assert.match(body.detail, /postgres unavailable/);
  } finally {
    await cleanup();
  }
});
