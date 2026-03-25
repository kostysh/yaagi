import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopServiceHarness } from '../../testing/workshop-fixture.ts';

void test('AC-F0015-05 encodes the full staged candidate lifecycle and rejects self-authorized live-stage transitions', async () => {
  const harness = await createWorkshopServiceHarness();

  try {
    const dataset = await harness.service.buildDataset({
      requestId: 'dataset-build-2',
      datasetKind: 'sft',
      sourceEpisodeIds: ['episode-3', 'episode-4'],
      sourceEvalRunIds: [],
      sourceHumanLabelIds: [],
      redactionProfile: 'episodes-redacted-v1',
    });
    const training = await harness.service.launchTrainingRun({
      requestId: 'training-run-2',
      targetKind: 'shared_adapter',
      targetProfileId: 'reflex.fast@baseline',
      datasetId: dataset.dataset.datasetId,
      method: 'lora',
    });
    const evaluation = await harness.service.launchEvalRun({
      requestId: 'eval-run-2',
      subjectKind: 'adapter_candidate',
      subjectRef: training.trainingRun.runId,
      suiteName: 'regression-suite',
    });
    const registered = await harness.service.registerModelCandidate({
      requestId: 'candidate-register-1',
      candidateKind: 'shared_adapter',
      targetProfileId: 'reflex.fast@baseline',
      datasetId: dataset.dataset.datasetId,
      trainingRunId: training.trainingRun.runId,
      latestEvalRunId: evaluation.evalRun.evalRunId,
      artifactUri: training.trainingRun.artifactUri,
      predecessorProfileId: 'reflex.fast@baseline',
      rollbackTarget: 'reflex.fast@baseline',
      requiredEvalSuite: 'regression-suite',
      lastKnownGoodEvalReportUri: evaluation.evalRun.reportUri,
    });

    await assert.rejects(
      () =>
        harness.service.recordCandidateStageTransition({
          requestId: 'transition-self-shadow',
          candidateId: registered.candidate.candidateId,
          toStage: 'shadow',
          triggerKind: 'approval_granted',
          evidenceRefs: ['approval:governor-1'],
          requestedByOwner: 'F-0015',
        }),
      /may not self-authorize transition into shadow/,
    );

    const shadow = await harness.service.recordCandidateStageTransition({
      requestId: 'transition-shadow',
      candidateId: registered.candidate.candidateId,
      toStage: 'shadow',
      triggerKind: 'approval_granted',
      evidenceRefs: ['approval:governor-1'],
      requestedByOwner: 'CF-016',
    });
    const limited = await harness.service.recordCandidateStageTransition({
      requestId: 'transition-limited',
      candidateId: registered.candidate.candidateId,
      toStage: 'limited-active',
      triggerKind: 'activation_confirmed',
      evidenceRefs: ['activation:baseline-router-1'],
      requestedByOwner: 'F-0008',
    });
    const active = await harness.service.recordCandidateStageTransition({
      requestId: 'transition-active',
      candidateId: registered.candidate.candidateId,
      toStage: 'active',
      triggerKind: 'activation_confirmed',
      evidenceRefs: ['activation:expanded-registry-1'],
      requestedByOwner: 'F-0014',
    });
    const stable = await harness.service.recordCandidateStageTransition({
      requestId: 'transition-stable',
      candidateId: registered.candidate.candidateId,
      toStage: 'stable',
      triggerKind: 'approval_granted',
      evidenceRefs: ['approval:governor-2'],
      requestedByOwner: 'CF-016',
    });
    const rollback = await harness.service.recordCandidateStageTransition({
      requestId: 'transition-rollback',
      candidateId: registered.candidate.candidateId,
      toStage: 'rollback',
      triggerKind: 'rollback_requested',
      evidenceRefs: ['rollback:incident-1'],
      requestedByOwner: 'CF-018',
    });

    assert.equal(shadow.candidate.stage, 'shadow');
    assert.equal(limited.candidate.stage, 'limited-active');
    assert.equal(active.candidate.stage, 'active');
    assert.equal(stable.candidate.stage, 'stable');
    assert.equal(rollback.candidate.stage, 'rollback');
    assert.equal(
      harness.state.candidateStageEventsById[rollback.event.eventId]?.requestedByOwner,
      'CF-018',
    );
  } finally {
    await harness.cleanup();
  }
});

void test('AC-F0015-05 rejects candidate registration when dataset, training, eval, or artifact lineage is incoherent', async () => {
  const harness = await createWorkshopServiceHarness();

  try {
    const dataset = await harness.service.buildDataset({
      requestId: 'dataset-build-coherence',
      datasetKind: 'sft',
      sourceEpisodeIds: ['episode-8'],
      sourceEvalRunIds: [],
      sourceHumanLabelIds: ['label-8'],
      redactionProfile: 'episodes-redacted-v1',
    });
    const training = await harness.service.launchTrainingRun({
      requestId: 'training-run-coherence',
      targetKind: 'shared_adapter',
      targetProfileId: 'deliberation.fast@baseline',
      datasetId: dataset.dataset.datasetId,
      method: 'lora',
    });
    const evaluation = await harness.service.launchEvalRun({
      requestId: 'eval-run-coherence',
      subjectKind: 'adapter_candidate',
      subjectRef: training.trainingRun.runId,
      suiteName: 'regression-suite',
    });

    await assert.rejects(
      () =>
        harness.service.registerModelCandidate({
          requestId: 'candidate-register-coherence-kind',
          candidateKind: 'specialist_candidate',
          targetProfileId: null,
          datasetId: dataset.dataset.datasetId,
          trainingRunId: training.trainingRun.runId,
          latestEvalRunId: evaluation.evalRun.evalRunId,
          artifactUri: training.trainingRun.artifactUri,
          predecessorProfileId: 'specialist.prev@shared',
          rollbackTarget: 'specialist.prev@shared',
          requiredEvalSuite: 'regression-suite',
          lastKnownGoodEvalReportUri: evaluation.evalRun.reportUri,
        }),
      /candidate kind must match the training lineage target kind/,
    );

    await assert.rejects(
      () =>
        harness.service.registerModelCandidate({
          requestId: 'candidate-register-coherence-artifact',
          candidateKind: 'shared_adapter',
          targetProfileId: 'deliberation.fast@baseline',
          datasetId: dataset.dataset.datasetId,
          trainingRunId: training.trainingRun.runId,
          latestEvalRunId: evaluation.evalRun.evalRunId,
          artifactUri: 'file:///tmp/other-artifact.json',
          predecessorProfileId: 'deliberation.fast@baseline',
          rollbackTarget: 'deliberation.fast@baseline',
          requiredEvalSuite: 'different-suite',
          lastKnownGoodEvalReportUri: evaluation.evalRun.reportUri,
        }),
      /required eval suite must match eval evidence/,
    );
  } finally {
    await harness.cleanup();
  }
});
