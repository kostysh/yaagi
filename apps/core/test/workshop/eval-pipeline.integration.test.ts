import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkshopStore } from '@yaagi/db';
import { createWorkshopService } from '../../src/workshop/service.ts';
import { createWorkshopDbHarness } from '../../../../packages/db/testing/workshop-db-harness.ts';
import { createWorkshopServiceHarness } from '../../testing/workshop-fixture.ts';

void test('AC-F0015-04 keeps shared-adapter training and eval lineage durable and auditable on the canonical workshop path', async () => {
  const harness = await createWorkshopServiceHarness();

  try {
    const dataset = await harness.service.buildDataset({
      requestId: 'dataset-build-1',
      datasetKind: 'sft',
      sourceEpisodeIds: ['episode-1', 'episode-2'],
      sourceEvalRunIds: [],
      sourceHumanLabelIds: ['label-1'],
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
      sourceHumanLabelIds: string[];
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
    assert.deepEqual(manifest.sourceHumanLabelIds, ['label-1']);
    assert.equal(manifest.hygiene.secretsExported, false);
    assert.equal(artifact.datasetId, dataset.dataset.datasetId);
    assert.equal(artifact.targetKind, 'shared_adapter');
  } finally {
    await harness.cleanup();
  }
});

void test('AC-F0015-04 durably records failed dataset, training, and eval attempts instead of leaving them only in logs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-workshop-failure-'));
  const dataBlocker = path.join(root, 'data-blocker');
  const modelsBlocker = path.join(root, 'models-blocker');
  await writeFile(dataBlocker, 'blocked\n', 'utf8');
  await writeFile(modelsBlocker, 'blocked\n', 'utf8');

  const harness = createWorkshopDbHarness();
  const store = createWorkshopStore(harness.db);
  const datasetFailureService = createWorkshopService({
    store,
    dataPath: dataBlocker,
    modelsPath: path.join(root, 'models-ok'),
    createId: (() => {
      let index = 0;
      return () => `failure-${++index}`;
    })(),
    now: () => new Date('2026-03-26T17:10:00.000Z'),
  });

  try {
    await assert.rejects(
      () =>
        datasetFailureService.buildDataset({
          requestId: 'dataset-build-failure',
          datasetKind: 'sft',
          sourceEpisodeIds: ['episode-1'],
          sourceEvalRunIds: [],
          sourceHumanLabelIds: [],
          redactionProfile: 'episodes-redacted-v1',
        }),
      /ENOTDIR|EEXIST|not a directory/i,
    );

    const failedDataset = Object.values(harness.state.datasetsById)[0];
    assert.equal(failedDataset?.status, 'failed');
    assert.equal(typeof failedDataset?.sourceManifestJson['failure'] === 'object', true);

    const okService = createWorkshopService({
      store,
      dataPath: path.join(root, 'data-ok'),
      modelsPath: path.join(root, 'models-ok'),
      createId: (() => {
        let index = 100;
        return () => `success-${++index}`;
      })(),
      now: () => new Date('2026-03-26T17:11:00.000Z'),
    });
    const readyDataset = await okService.buildDataset({
      requestId: 'dataset-build-ready',
      datasetKind: 'sft',
      sourceEpisodeIds: ['episode-2'],
      sourceEvalRunIds: [],
      sourceHumanLabelIds: [],
      redactionProfile: 'episodes-redacted-v1',
    });

    const trainingFailureService = createWorkshopService({
      store,
      dataPath: path.join(root, 'data-ok'),
      modelsPath: modelsBlocker,
      createId: (() => {
        let index = 200;
        return () => `training-${++index}`;
      })(),
      now: () => new Date('2026-03-26T17:12:00.000Z'),
    });
    await assert.rejects(
      () =>
        trainingFailureService.launchTrainingRun({
          requestId: 'training-build-failure',
          targetKind: 'shared_adapter',
          targetProfileId: 'reflex.fast@baseline',
          datasetId: readyDataset.dataset.datasetId,
          method: 'lora',
        }),
      /ENOTDIR|EEXIST|not a directory/i,
    );

    const failedTraining = Object.values(harness.state.trainingRunsById).find(
      (row) => row.status === 'failed',
    );
    assert.equal(failedTraining?.datasetId, readyDataset.dataset.datasetId);
    assert.equal(failedTraining?.metricsJson['result'], 'failed');

    const evalFailureService = createWorkshopService({
      store,
      dataPath: dataBlocker,
      modelsPath: path.join(root, 'models-ok'),
      createId: (() => {
        let index = 300;
        return () => `eval-${++index}`;
      })(),
      now: () => new Date('2026-03-26T17:13:00.000Z'),
    });
    await assert.rejects(
      () =>
        evalFailureService.launchEvalRun({
          requestId: 'eval-build-failure',
          subjectKind: 'adapter_candidate',
          subjectRef: 'training-ref',
          suiteName: 'regression-suite',
        }),
      /ENOTDIR|EEXIST|not a directory/i,
    );

    const failedEval = Object.values(harness.state.evalRunsById).find((row) => row.pass === false);
    assert.equal(failedEval?.suiteName, 'regression-suite');
    assert.equal(failedEval?.metricsJson['result'], 'failed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
