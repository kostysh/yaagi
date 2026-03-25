import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorkshopServiceHarness } from '../../testing/workshop-fixture.ts';

void test('AC-F0015-04 keeps shared-adapter training and eval lineage durable and auditable on the canonical workshop path', async () => {
  const harness = await createWorkshopServiceHarness();

  try {
    const dataset = await harness.service.buildDataset({
      requestId: 'dataset-build-1',
      datasetKind: 'sft',
      sourceEpisodeIds: ['episode-1', 'episode-2'],
      sourceEvalRunIds: [],
      redactionProfile: 'episodes-redacted-v1',
    });
    const training = await harness.service.launchTrainingRun({
      requestId: 'training-run-1',
      targetKind: 'shared_adapter',
      targetProfileId: 'deliberation.fast@baseline',
      datasetId: dataset.dataset.datasetId,
      method: 'lora',
    });
    const evaluation = await harness.service.launchEvalRun({
      requestId: 'eval-run-1',
      subjectKind: 'adapter_candidate',
      subjectRef: training.trainingRun.runId,
      suiteName: 'regression-suite',
    });

    const manifest = JSON.parse(await readFile(new URL(dataset.manifestUri), 'utf8')) as {
      hygiene: {
        secretsExported: boolean;
      };
    };
    const artifact = JSON.parse(
      await readFile(new URL(training.trainingRun.artifactUri), 'utf8'),
    ) as {
      datasetId: string;
      targetKind: string;
    };

    assert.equal(dataset.dataset.status, 'ready');
    assert.equal(training.trainingRun.datasetId, dataset.dataset.datasetId);
    assert.equal(evaluation.evalRun.subjectRef, training.trainingRun.runId);
    assert.equal(manifest.hygiene.secretsExported, false);
    assert.equal(artifact.datasetId, dataset.dataset.datasetId);
    assert.equal(artifact.targetKind, 'shared_adapter');
  } finally {
    await harness.cleanup();
  }
});
