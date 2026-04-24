import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_AUTOMATION_REJECTION_REASON,
  RELEASE_REQUEST_SOURCE,
  RELEASE_SMOKE_STATUS,
  RELEASE_TARGET_ENVIRONMENT,
} from '@yaagi/contracts/release-automation';
import {
  createCanonicalFormatReleasePrerequisiteValidator,
  createReleaseAutomationService,
} from '../../src/platform/release-automation.ts';
import { createInMemoryReleaseAutomationStore } from '../../testing/release-automation-fixture.ts';

const prepareRelease = async (
  service: ReturnType<typeof createReleaseAutomationService>,
  requestId = 'release-request:preflight',
) => {
  const result = await service.prepareRelease({
    requestId,
    targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
    gitRef: 'git:main',
    actorRef: 'operator:release',
    source: RELEASE_REQUEST_SOURCE.CLI,
    rollbackTargetRef: 'git:stable',
    governorEvidenceRef: 'development-proposal-decision:1',
    lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
    modelServingReadinessRef: 'model_profile_health:code.deep@shared',
    diagnosticReportRefs: ['report-run:development'],
    requestedAt: '2026-04-24T17:55:00.000Z',
  });
  assert.equal(result.accepted, true);
};

void test('AC-F0026-04 AC-F0026-11 fails deploy preflight without smoke harness', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-preflight-'));
  const { store } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: null,
  });

  try {
    await prepareRelease(service);
    const result = await service.runDeployAttempt({ requestId: 'release-request:preflight' });
    assert.deepEqual(result, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.SMOKE_HARNESS_UNAVAILABLE,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-11 terminally fails deploy attempt when configured smoke harness is unavailable', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-smoke-unavailable-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.UNAVAILABLE,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:00:00.000Z',
        finishedAt: '2026-04-24T18:00:01.000Z',
        exitCode: null,
        evidenceRef: null,
      }),
  });

  try {
    await prepareRelease(service, 'release-request:smoke-unavailable');
    const result = await service.runDeployAttempt({
      requestId: 'release-request:smoke-unavailable',
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

void test('AC-F0026-04 AC-F0026-11 fails deploy preflight when evidence root is not writable', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-preflight-'));
  const evidenceRootPath = path.join(root, 'not-a-directory');
  await writeFile(evidenceRootPath, 'occupied\n', 'utf8');
  const { store } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () => Promise.reject(new Error('should not run smoke')),
  });

  try {
    await prepareRelease(service, 'release-request:evidence-root');
    const result = await service.runDeployAttempt({ requestId: 'release-request:evidence-root' });
    assert.deepEqual(result, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.EVIDENCE_STORAGE_UNAVAILABLE,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
