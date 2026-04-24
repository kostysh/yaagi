import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_REQUEST_SOURCE,
  RELEASE_SMOKE_STATUS,
  RELEASE_TARGET_ENVIRONMENT,
} from '@yaagi/contracts/release-automation';
import {
  createCanonicalFormatReleasePrerequisiteValidator,
  createReleaseAutomationService,
} from '../../src/platform/release-automation.ts';
import { createInMemoryReleaseAutomationStore } from '../../testing/release-automation-fixture.ts';

void test('AC-F0026-05 AC-F0026-06 AC-F0026-13 materializes complete release evidence linked from store state', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-evidence-'));
  const { store } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: () =>
      Promise.resolve({
        status: RELEASE_SMOKE_STATUS.PASSED,
        command: 'pnpm smoke:cell',
        startedAt: '2026-04-24T18:00:00.000Z',
        finishedAt: '2026-04-24T18:01:00.000Z',
        exitCode: 0,
        evidenceRef: 'file:smoke:passed',
      }),
    now: () => '2026-04-24T18:01:01.000Z',
  });

  try {
    await service.prepareRelease({
      requestId: 'release-request:evidence',
      targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
      gitRef: 'git:main',
      actorRef: 'operator:release',
      source: RELEASE_REQUEST_SOURCE.CLI,
      rollbackTargetRef: 'git:stable',
      governorEvidenceRef: 'development-proposal-decision:1',
      lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
      modelServingReadinessRef: 'model_profile_health:code.deep@shared',
      diagnosticReportRefs: ['report-run:development'],
      requestedAt: '2026-04-24T18:00:00.000Z',
    });

    const result = await service.runDeployAttempt({ requestId: 'release-request:evidence' });

    assert.equal(result.accepted, true);
    if (!result.accepted) {
      return;
    }
    assert.equal(result.deployAttempt.status, DEPLOY_ATTEMPT_STATUS.SUCCEEDED);
    assert.equal(result.evidenceBundle.smokeOnDeployResult.status, 'passed');
    assert.equal(result.evidenceBundle.governorEvidenceRef, 'development-proposal-decision:1');
    assert.equal(result.evidenceBundle.lifecycleRollbackTargetRef, 'graceful_shutdown:shutdown-1');
    assert.equal(
      result.evidenceBundle.modelServingReadinessRef,
      'model_profile_health:code.deep@shared',
    );
    assert.deepEqual(result.evidenceBundle.diagnosticReportRefs, ['report-run:development']);
    assert.match(result.evidenceBundle.fileArtifactRefs[0] ?? '', /^file:release-evidence:/);

    const fileName = result.evidenceBundle.fileArtifactRefs[0]?.replace(
      'file:release-evidence:',
      '',
    );
    assert.ok(fileName);
    const materialized = JSON.parse(await readFile(path.join(root, fileName), 'utf8')) as {
      smokeOnDeployResult: { status: string };
    };
    assert.equal(materialized.smokeOnDeployResult.status, RELEASE_SMOKE_STATUS.PASSED);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
