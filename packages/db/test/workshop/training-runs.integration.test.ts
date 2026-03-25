import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopStore } from '../../src/index.ts';
import { createWorkshopDbHarness } from '../../testing/workshop-db-harness.ts';

void test('AC-F0015-04 persists durable training and eval lineage linked to the canonical dataset substrate', async () => {
  const harness = createWorkshopDbHarness();
  const store = createWorkshopStore(harness.db);

  await store.persistDataset({
    datasetId: 'dataset-lineage-1',
    datasetKind: 'sft',
    sourceManifestJson: { owner: 'F-0015' },
    sourceEpisodeIdsJson: ['episode-1'],
    splitManifestJson: { trainRefs: ['episode:episode-1'], validationRefs: [], holdoutRefs: [] },
    status: 'ready',
    createdAt: '2026-03-26T16:10:00.000Z',
  });

  const trainingRun = await store.persistTrainingRun({
    runId: 'training-1',
    targetKind: 'shared_adapter',
    targetProfileId: 'deliberation.fast@baseline',
    datasetId: 'dataset-lineage-1',
    method: 'lora',
    hyperparamsJson: { rank: 16 },
    metricsJson: { score: 0.94 },
    artifactUri: 'file:///tmp/models/adapters/training-1/artifact.json',
    status: 'completed',
    startedAt: '2026-03-26T16:11:00.000Z',
    endedAt: '2026-03-26T16:12:00.000Z',
  });

  const evalRun = await store.persistEvalRun({
    evalRunId: 'eval-1',
    subjectKind: 'adapter_candidate',
    subjectRef: 'training-1',
    suiteName: 'regression-suite',
    metricsJson: { passRate: 0.98 },
    pass: true,
    reportUri: 'file:///tmp/data/reports/workshop/evals/eval-1.json',
    createdAt: '2026-03-26T16:13:00.000Z',
  });

  assert.equal(trainingRun.datasetId, 'dataset-lineage-1');
  assert.equal(evalRun.subjectRef, 'training-1');
  assert.equal(
    harness.state.trainingRunsById['training-1']?.artifactUri.includes('/models/adapters/'),
    true,
  );
});

void test('AC-F0015-04 refuses to persist a training run without a canonical dataset dependency', async () => {
  const harness = createWorkshopDbHarness();
  const store = createWorkshopStore(harness.db);

  await assert.rejects(
    () =>
      store.persistTrainingRun({
        runId: 'training-missing-dataset',
        targetKind: 'shared_adapter',
        targetProfileId: null,
        datasetId: 'missing-dataset',
        method: 'lora',
        hyperparamsJson: {},
        metricsJson: {},
        artifactUri: 'file:///tmp/models/adapters/training-missing-dataset/artifact.json',
        status: 'failed',
        startedAt: '2026-03-26T16:14:00.000Z',
        endedAt: '2026-03-26T16:14:01.000Z',
      }),
    /unknown dataset/,
  );
});
