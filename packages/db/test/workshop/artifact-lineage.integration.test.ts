import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopStore } from '../../src/index.ts';
import { createWorkshopDbHarness } from '../../testing/workshop-db-harness.ts';

void test('AC-F0015-08 keeps candidate artifact lineage and lifecycle events on canonical workshop source surfaces', async () => {
  const harness = createWorkshopDbHarness();
  const store = createWorkshopStore(harness.db);

  await store.persistDataset({
    datasetId: 'dataset-artifacts-1',
    datasetKind: 'sft',
    sourceManifestJson: { owner: 'F-0015' },
    sourceEpisodeIdsJson: ['episode-1'],
    splitManifestJson: { trainRefs: ['episode:episode-1'], validationRefs: [], holdoutRefs: [] },
    status: 'ready',
    createdAt: '2026-03-26T16:20:00.000Z',
  });
  await store.persistTrainingRun({
    runId: 'training-artifacts-1',
    targetKind: 'shared_adapter',
    targetProfileId: 'reflex.fast@baseline',
    datasetId: 'dataset-artifacts-1',
    method: 'lora',
    hyperparamsJson: { rank: 16 },
    metricsJson: { score: 0.93 },
    artifactUri: 'file:///tmp/models/adapters/training-artifacts-1/artifact.json',
    status: 'completed',
    startedAt: '2026-03-26T16:21:00.000Z',
    endedAt: '2026-03-26T16:21:01.000Z',
  });
  await store.persistEvalRun({
    evalRunId: 'eval-artifacts-1',
    subjectKind: 'adapter_candidate',
    subjectRef: 'training-artifacts-1',
    suiteName: 'regression-suite',
    metricsJson: { passRate: 1 },
    pass: true,
    reportUri: 'file:///tmp/data/reports/workshop/evals/eval-artifacts-1.json',
    createdAt: '2026-03-26T16:21:30.000Z',
  });

  const registered = await store.registerCandidate({
    candidateId: 'candidate-artifacts-1',
    candidateKind: 'shared_adapter',
    targetProfileId: 'reflex.fast@baseline',
    datasetId: 'dataset-artifacts-1',
    trainingRunId: 'training-artifacts-1',
    latestEvalRunId: 'eval-artifacts-1',
    artifactUri: 'file:///tmp/models/adapters/training-artifacts-1/artifact.json',
    stage: 'candidate',
    predecessorProfileId: 'reflex.fast@baseline',
    rollbackTarget: 'reflex.fast@baseline',
    requiredEvalSuite: 'regression-suite',
    lastKnownGoodEvalReportUri: 'file:///tmp/data/reports/workshop/evals/eval-artifacts-1.json',
    statusReason: 'candidate recorded',
    createdAt: '2026-03-26T16:22:00.000Z',
    updatedAt: '2026-03-26T16:22:00.000Z',
    initialEvent: {
      eventId: 'event-candidate-1',
      triggerKind: 'workshop_eval_passed',
      evidenceJson: {
        latestEvalRunId: 'eval-artifacts-1',
      },
      requestedByOwner: 'F-0015',
      createdAt: '2026-03-26T16:22:00.000Z',
    },
  });

  const transition = await store.recordCandidateStageTransition({
    eventId: 'event-shadow-1',
    candidateId: 'candidate-artifacts-1',
    toStage: 'shadow',
    triggerKind: 'approval_granted',
    evidenceJson: {
      evidenceRefs: ['approval:governor-1'],
    },
    requestedByOwner: 'CF-016',
    statusReason: 'shadow approved',
    createdAt: '2026-03-26T16:23:00.000Z',
    updatedAt: '2026-03-26T16:23:00.000Z',
  });

  const events = await store.listCandidateStageEvents({
    candidateId: 'candidate-artifacts-1',
  });

  assert.equal(registered.candidate.artifactUri.includes('/models/adapters/'), true);
  assert.equal(transition.candidate.stage, 'shadow');
  assert.deepEqual(
    events.map((event) => ({
      toStage: event.toStage,
      requestedByOwner: event.requestedByOwner,
    })),
    [
      { toStage: 'candidate', requestedByOwner: 'F-0015' },
      { toStage: 'shadow', requestedByOwner: 'CF-016' },
    ],
  );
});
