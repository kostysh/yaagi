import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopServiceHarness } from '../../testing/workshop-fixture.ts';

void test('AC-F0015-07 prepares handoff evidence without seizing baseline, richer-registry or specialist ownership', async () => {
  const harness = await createWorkshopServiceHarness();

  try {
    const dataset = await harness.service.buildDataset({
      requestId: 'dataset-build-5',
      datasetKind: 'specialist',
      sourceEpisodeIds: ['episode-7'],
      sourceEvalRunIds: [],
      redactionProfile: 'specialist-redacted-v1',
    });
    const training = await harness.service.launchTrainingRun({
      requestId: 'training-run-5',
      targetKind: 'specialist_candidate',
      targetProfileId: null,
      datasetId: dataset.dataset.datasetId,
      method: 'lora',
    });
    const evaluation = await harness.service.launchEvalRun({
      requestId: 'eval-run-5',
      subjectKind: 'specialist_candidate',
      subjectRef: training.trainingRun.runId,
      suiteName: 'specialist-regression-suite',
    });
    const candidate = await harness.service.registerModelCandidate({
      requestId: 'candidate-register-4',
      candidateKind: 'specialist_candidate',
      targetProfileId: null,
      datasetId: dataset.dataset.datasetId,
      trainingRunId: training.trainingRun.runId,
      latestEvalRunId: evaluation.evalRun.evalRunId,
      artifactUri: training.trainingRun.artifactUri,
      predecessorProfileId: 'specialist.predecessor@shared',
      rollbackTarget: 'specialist.predecessor@shared',
      requiredEvalSuite: 'specialist-regression-suite',
      lastKnownGoodEvalReportUri: evaluation.evalRun.reportUri,
    });

    await harness.service.recordCandidateStageTransition({
      requestId: 'transition-shadow-4',
      candidateId: candidate.candidate.candidateId,
      toStage: 'shadow',
      triggerKind: 'approval_granted',
      evidenceRefs: ['approval:governor-5', 'specialist-policy:pending'],
      requestedByOwner: 'CF-019',
    });

    const result = await harness.service.preparePromotionPackage({
      requestId: 'promotion-package-2',
      candidateId: candidate.candidate.candidateId,
    });

    assert.equal(result.promotionPackage.candidateKind, 'specialist_candidate');
    assert.equal(result.promotionPackage.targetProfileId, null);
    assert.ok(
      Object.keys(harness.state).every((key) =>
        [
          'datasetsById',
          'trainingRunsById',
          'evalRunsById',
          'candidatesById',
          'candidateStageEventsById',
        ].includes(key),
      ),
    );
  } finally {
    await harness.cleanup();
  }
});
