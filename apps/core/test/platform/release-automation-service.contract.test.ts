import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  RELEASE_AUTOMATION_REJECTION_REASON,
  RELEASE_REQUEST_SOURCE,
  RELEASE_TARGET_ENVIRONMENT,
} from '@yaagi/contracts/release-automation';
import {
  createCanonicalFormatReleasePrerequisiteValidator,
  createReleaseAutomationService,
} from '../../src/platform/release-automation.ts';
import { createInMemoryReleaseAutomationStore } from '../../testing/release-automation-fixture.ts';

const prepareInput = {
  requestId: 'release-request:service-1',
  targetEnvironment: RELEASE_TARGET_ENVIRONMENT.LOCAL,
  gitRef: 'git:main',
  actorRef: 'operator:release',
  source: RELEASE_REQUEST_SOURCE.CLI,
  rollbackTargetRef: 'git:stable',
  governorEvidenceRef: 'development-proposal-decision:1',
  lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
  modelServingReadinessRef: 'model_profile_health:code.deep@shared',
  diagnosticReportRefs: ['report-run:development'],
  requestedAt: '2026-04-24T17:50:00.000Z',
};

void test('AC-F0026-01 AC-F0026-03 AC-F0026-04 prepares release request and rollback plan through one service', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-service-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: null,
  });

  try {
    const first = await service.prepareRelease(prepareInput);
    const replay = await service.prepareRelease(prepareInput);
    const conflict = await service.prepareRelease({
      ...prepareInput,
      gitRef: 'git:other',
    });
    const rollbackConflict = await service.prepareRelease({
      ...prepareInput,
      rollbackTargetRef: 'git:other-stable',
    });

    assert.equal(first.accepted, true);
    assert.equal(replay.accepted, true);
    assert.equal(conflict.accepted, false);
    assert.equal(rollbackConflict.accepted, false);
    if (first.accepted && replay.accepted && !conflict.accepted && !rollbackConflict.accepted) {
      assert.equal(first.rollbackPlan.rollbackTargetRef, 'git:stable');
      assert.equal(replay.requestDeduplicated, true);
      assert.equal(conflict.reason, RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT);
      assert.equal(
        rollbackConflict.reason,
        RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
      );
    }
    assert.equal(state.releaseRequests.length, 1);
    assert.equal(state.rollbackPlans.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-03 replays prepared release without revalidating live prerequisites', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-service-replay-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: null,
  });

  try {
    const first = await service.prepareRelease({
      ...prepareInput,
      requestId: 'release-request:service-live-prerequisite-replay',
    });
    const replayService = createReleaseAutomationService({
      store,
      evidenceRootPath: root,
      prerequisiteValidator: () =>
        Promise.resolve({
          accepted: false as const,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE,
        }),
      smokeRunner: null,
    });
    const replay = await replayService.prepareRelease({
      ...prepareInput,
      requestId: 'release-request:service-live-prerequisite-replay',
    });

    assert.equal(first.accepted, true);
    assert.equal(replay.accepted, true);
    if (replay.accepted) {
      assert.equal(replay.requestDeduplicated, true);
      assert.equal(replay.rollbackPlanDeduplicated, true);
    }
    assert.equal(state.releaseRequests.length, 1);
    assert.equal(state.rollbackPlans.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-03 replays prepared release by recreating a missing rollback plan without live prerequisite checks', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-service-plan-repair-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: null,
  });

  try {
    const first = await service.prepareRelease({
      ...prepareInput,
      requestId: 'release-request:service-missing-plan-replay',
    });
    assert.equal(first.accepted, true);
    state.rollbackPlans.length = 0;

    const changedTarget = await service.prepareRelease({
      ...prepareInput,
      requestId: 'release-request:service-missing-plan-replay',
      rollbackTargetRef: 'git:other-stable',
    });
    assert.deepEqual(changedTarget, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
      existingRequest: state.releaseRequests[0],
    });
    assert.equal(state.rollbackPlans.length, 0);

    const replayService = createReleaseAutomationService({
      store,
      evidenceRootPath: root,
      prerequisiteValidator: () =>
        Promise.resolve({
          accepted: false as const,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MODEL_READINESS_UNAVAILABLE,
        }),
      smokeRunner: null,
    });
    const replay = await replayService.prepareRelease({
      ...prepareInput,
      requestId: 'release-request:service-missing-plan-replay',
    });

    assert.equal(replay.accepted, true);
    if (replay.accepted) {
      assert.equal(replay.requestDeduplicated, true);
      assert.equal(replay.rollbackPlanDeduplicated, false);
      assert.equal(replay.rollbackPlan.rollbackTargetRef, 'git:stable');
    }
    assert.equal(state.releaseRequests.length, 1);
    assert.equal(state.rollbackPlans.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-11 rejects release preparation when required read-only evidence refs are absent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-service-'));
  const { store } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: null,
  });

  try {
    const result = await service.prepareRelease({
      ...prepareInput,
      requestId: 'release-request:missing-governor',
      governorEvidenceRef: '',
    });

    assert.deepEqual(result, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-11 AC-F0026-13 rejects non-canonical prerequisite evidence refs before release state writes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-service-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: null,
  });

  try {
    const result = await service.prepareRelease({
      ...prepareInput,
      requestId: 'release-request:placeholder-evidence',
      governorEvidenceRef: 'governor:evidence:placeholder',
    });

    assert.deepEqual(result, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.GOVERNOR_EVIDENCE_MISSING,
    });
    assert.equal(state.releaseRequests.length, 0);
    assert.equal(state.rollbackPlans.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0026-11 rejects supplemental evidence refs that use reserved prerequisite prefixes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-release-service-'));
  const { store, state } = createInMemoryReleaseAutomationStore();
  const service = createReleaseAutomationService({
    store,
    evidenceRootPath: root,
    prerequisiteValidator: createCanonicalFormatReleasePrerequisiteValidator(),
    smokeRunner: null,
  });

  try {
    const result = await service.prepareRelease({
      ...prepareInput,
      requestId: 'release-request:reserved-supplemental-evidence',
      evidenceRefs: ['development-proposal-decision:shadow'],
    });

    assert.deepEqual(result, {
      accepted: false,
      reason: RELEASE_AUTOMATION_REJECTION_REASON.RESERVED_EVIDENCE_REF_REJECTED,
    });
    assert.equal(state.releaseRequests.length, 0);
    assert.equal(state.rollbackPlans.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
