import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEASE_AUTOMATION_FOREIGN_WRITE_SURFACE,
  RELEASE_AUTOMATION_OWNED_WRITE_SURFACE,
  RELEASE_REQUEST_SOURCE,
  RELEASE_TARGET_ENVIRONMENT,
  RELEASE_SMOKE_STATUS,
  ROLLBACK_EXECUTION_MODE,
  ROLLBACK_EXECUTION_STATUS,
  ROLLBACK_EXECUTION_TRIGGER,
  ROLLBACK_PLAN_PREFLIGHT_STATUS,
  assertReleaseAutomationOwnedWriteSurface,
  releaseEvidenceBundleSchema,
  releaseRequestSchema,
  rollbackExecutionSchema,
  rollbackPlanSchema,
} from '../src/release-automation.ts';

void test('AC-F0026-01 AC-F0026-02 exposes canonical release vocabulary', () => {
  const request = releaseRequestSchema.parse({
    requestId: 'release-request:1',
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.RELEASE_CELL,
    gitRef: 'git:main',
    rollbackTargetRef: 'git:stable',
    actorRef: 'operator:release',
    source: RELEASE_REQUEST_SOURCE.OPERATOR_API,
    evidenceRefs: ['development-proposal-decision:1'],
    requestedAt: '2026-04-24T17:30:00.000Z',
  });

  assert.equal(request.targetEnvironment, 'release_cell');
  assert.equal(request.source, 'operator_api');
  assert.equal(request.rollbackTargetRef, 'git:stable');
  assert.equal(request.requestedAction, 'deploy');

  assert.throws(
    () =>
      releaseRequestSchema.parse({
        ...request,
        targetEnvironment: 'staging',
      }),
    /Invalid option/,
  );
});

void test('AC-F0026-04 AC-F0026-05 validates rollback plan and evidence bundle shape', () => {
  const plan = rollbackPlanSchema.parse({
    rollbackPlanId: 'rollback-plan:1',
    releaseRequestId: 'release-request:1',
    rollbackTargetRef: 'git:stable',
    requiredEvidenceRefs: ['development-proposal-decision:1', 'graceful_shutdown:shutdown-1'],
    executionMode: ROLLBACK_EXECUTION_MODE.AUTOMATIC,
    preflightStatus: ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
    createdAt: '2026-04-24T17:31:00.000Z',
  });

  assert.equal(plan.deployAttemptId, null);
  assert.deepEqual(plan.requiredEvidenceRefs, [
    'development-proposal-decision:1',
    'graceful_shutdown:shutdown-1',
  ]);

  const bundle = releaseEvidenceBundleSchema.parse({
    evidenceBundleId: 'release-evidence:1',
    releaseRequestId: 'release-request:1',
    deployAttemptId: 'deploy-attempt:1',
    commitRef: 'git:main',
    deploymentIdentity: 'deployment:local:1',
    migrationState: 'schema:022_release_automation',
    smokeOnDeployResult: {
      status: RELEASE_SMOKE_STATUS.PASSED,
      command: 'pnpm smoke:cell',
      startedAt: '2026-04-24T17:32:00.000Z',
      finishedAt: '2026-04-24T17:33:00.000Z',
      exitCode: 0,
      evidenceRef: 'file:smoke:1',
    },
    modelServingReadinessRef: 'model_profile_health:code.deep@shared',
    governorEvidenceRef: 'development-proposal-decision:1',
    lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
    diagnosticReportRefs: ['report-run:development'],
    fileArtifactRefs: ['file:release-evidence:1'],
    materializedAt: '2026-04-24T17:33:01.000Z',
  });

  assert.equal(bundle.smokeOnDeployResult.status, 'passed');
  assert.equal(bundle.governorEvidenceRef, 'development-proposal-decision:1');
});

void test('AC-F0026-10 validates rollback execution evidence', () => {
  const execution = rollbackExecutionSchema.parse({
    rollbackExecutionId: 'rollback-execution:1',
    rollbackPlanId: 'rollback-plan:1',
    deployAttemptId: 'deploy-attempt:1',
    trigger: ROLLBACK_EXECUTION_TRIGGER.AUTO_SMOKE_FAILURE,
    status: ROLLBACK_EXECUTION_STATUS.CRITICAL_FAILURE,
    evidenceRefs: ['rollback:evidence:1'],
    diagnosticReportRefs: ['report-run:development'],
    executedAt: '2026-04-24T17:34:00.000Z',
    failureReason: 'rollback executor unavailable',
  });

  assert.equal(execution.trigger, 'auto_smoke_failure');
  assert.equal(execution.status, 'critical_failure');
  assert.equal(
    rollbackExecutionSchema.parse({
      ...execution,
      rollbackExecutionId: 'rollback-execution:running',
      status: ROLLBACK_EXECUTION_STATUS.RUNNING,
      failureReason: null,
    }).status,
    'running',
  );
});

void test('AC-F0026-12 AC-F0026-14 AC-F0026-15 AC-F0026-16 rejects foreign owner write surfaces', () => {
  assert.doesNotThrow(() =>
    assertReleaseAutomationOwnedWriteSurface(
      RELEASE_AUTOMATION_OWNED_WRITE_SURFACE.RELEASE_REQUESTS,
    ),
  );

  assert.throws(
    () =>
      assertReleaseAutomationOwnedWriteSurface(
        RELEASE_AUTOMATION_FOREIGN_WRITE_SURFACE.LIFECYCLE_EVENTS,
      ),
    /foreign_owner_write_rejected/,
  );
});
