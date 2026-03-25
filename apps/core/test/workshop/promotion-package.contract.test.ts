import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopServiceHarness } from '../../testing/workshop-fixture.ts';

void test('AC-F0015-06 assembles a bounded promotion package from lifecycle truth and required rollback/eval evidence', async () => {
  const harness = await createWorkshopServiceHarness();

  try {
    const dataset = await harness.service.buildDataset({
      requestId: 'dataset-build-3',
      datasetKind: 'sft',
      sourceEpisodeIds: ['episode-5'],
      sourceEvalRunIds: [],
      sourceHumanLabelIds: [],
      redactionProfile: 'episodes-redacted-v1',
    });
    const training = await harness.service.launchTrainingRun({
      requestId: 'training-run-3',
      targetKind: 'shared_adapter',
      targetProfileId: 'deliberation.fast@baseline',
      datasetId: dataset.dataset.datasetId,
      method: 'qlora',
    });
    const evaluation = await harness.service.launchEvalRun({
      requestId: 'eval-run-3',
      subjectKind: 'adapter_candidate',
      subjectRef: training.trainingRun.runId,
      suiteName: 'regression-suite',
    });
    const candidate = await harness.service.registerModelCandidate({
      requestId: 'candidate-register-2',
      candidateKind: 'shared_adapter',
      targetProfileId: 'deliberation.fast@baseline',
      datasetId: dataset.dataset.datasetId,
      trainingRunId: training.trainingRun.runId,
      latestEvalRunId: evaluation.evalRun.evalRunId,
      artifactUri: training.trainingRun.artifactUri,
      predecessorProfileId: 'deliberation.fast@baseline',
      rollbackTarget: 'deliberation.fast@baseline',
      requiredEvalSuite: 'regression-suite',
      lastKnownGoodEvalReportUri: evaluation.evalRun.reportUri,
    });

    await harness.service.recordCandidateStageTransition({
      requestId: 'transition-shadow-2',
      candidateId: candidate.candidate.candidateId,
      toStage: 'shadow',
      triggerKind: 'approval_granted',
      evidenceRefs: ['approval:governor-3'],
      requestedByOwner: 'CF-016',
    });

    const result = await harness.service.preparePromotionPackage({
      requestId: 'promotion-package-1',
      candidateId: candidate.candidate.candidateId,
    });

    assert.equal(result.promotionPackage.candidateStage, 'shadow');
    assert.equal(result.promotionPackage.rollbackTarget, 'deliberation.fast@baseline');
    assert.match(result.packageUri, /promotion/);
  } finally {
    await harness.cleanup();
  }
});

void test('AC-F0015-06 refuses to assemble a promotion package before handoff-ready stage or without rollback metadata', async () => {
  const harness = await createWorkshopServiceHarness();

  try {
    const dataset = await harness.service.buildDataset({
      requestId: 'dataset-build-4',
      datasetKind: 'sft',
      sourceEpisodeIds: ['episode-6'],
      sourceEvalRunIds: [],
      sourceHumanLabelIds: [],
      redactionProfile: 'episodes-redacted-v1',
    });
    const training = await harness.service.launchTrainingRun({
      requestId: 'training-run-4',
      targetKind: 'shared_adapter',
      targetProfileId: null,
      datasetId: dataset.dataset.datasetId,
      method: 'lora',
    });
    const evaluation = await harness.service.launchEvalRun({
      requestId: 'eval-run-4',
      subjectKind: 'adapter_candidate',
      subjectRef: training.trainingRun.runId,
      suiteName: 'regression-suite',
    });
    const candidate = await harness.service.registerModelCandidate({
      requestId: 'candidate-register-3',
      candidateKind: 'shared_adapter',
      targetProfileId: null,
      datasetId: dataset.dataset.datasetId,
      trainingRunId: training.trainingRun.runId,
      latestEvalRunId: evaluation.evalRun.evalRunId,
      artifactUri: training.trainingRun.artifactUri,
      predecessorProfileId: null,
      rollbackTarget: null,
      requiredEvalSuite: 'regression-suite',
      lastKnownGoodEvalReportUri: evaluation.evalRun.reportUri,
    });

    await assert.rejects(
      () =>
        harness.service.preparePromotionPackage({
          requestId: 'promotion-package-prestage',
          candidateId: candidate.candidate.candidateId,
        }),
      /handoff-ready lifecycle stage/,
    );

    await harness.service.recordCandidateStageTransition({
      requestId: 'transition-shadow-3',
      candidateId: candidate.candidate.candidateId,
      toStage: 'shadow',
      triggerKind: 'approval_granted',
      evidenceRefs: ['approval:governor-4'],
      requestedByOwner: 'CF-016',
    });

    await assert.rejects(
      () =>
        harness.service.preparePromotionPackage({
          requestId: 'promotion-package-missing-rollback',
          candidateId: candidate.candidate.candidateId,
        }),
      /requires predecessorProfileId/,
    );
  } finally {
    await harness.cleanup();
  }
});
