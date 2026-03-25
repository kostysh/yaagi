import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopStore } from '../../src/index.ts';
import { createWorkshopDbHarness } from '../../testing/workshop-db-harness.ts';

void test('AC-F0015-01 persists canonical workshop datasets without shadow helper state', async () => {
  const harness = createWorkshopDbHarness();
  const store = createWorkshopStore(harness.db);

  const dataset = await store.persistDataset({
    datasetId: 'dataset-1',
    datasetKind: 'sft',
    sourceManifestJson: {
      owner: 'F-0015',
      manifestUri: 'file:///tmp/datasets/dataset-1/manifest.json',
      sourceRefs: ['episode:episode-1', 'episode:episode-2'],
      redactionProfile: 'episodes-redacted-v1',
    },
    sourceEpisodeIdsJson: ['episode-1', 'episode-2'],
    splitManifestJson: {
      trainRefs: ['episode:episode-1'],
      validationRefs: ['episode:episode-2'],
      holdoutRefs: [],
    },
    status: 'ready',
    createdAt: '2026-03-26T16:00:00.000Z',
  });

  assert.equal(dataset.datasetId, 'dataset-1');
  assert.equal(dataset.datasetKind, 'sft');
  assert.equal(dataset.sourceManifestJson['owner'], 'F-0015');
  assert.deepEqual(harness.state.datasetsById['dataset-1']?.sourceEpisodeIdsJson, [
    'episode-1',
    'episode-2',
  ]);
});

void test('AC-F0015-03 keeps provenance, redaction and split manifests machine-readable at the store boundary', async () => {
  const harness = createWorkshopDbHarness();
  const store = createWorkshopStore(harness.db);

  await store.persistDataset({
    datasetId: 'dataset-2',
    datasetKind: 'specialist',
    sourceManifestJson: {
      owner: 'F-0015',
      secretsExported: false,
      unreviewedAutobiographicalProseAllowed: false,
      redactionProfile: 'specialist-redacted-v1',
    },
    sourceEpisodeIdsJson: ['episode-specialist-1'],
    splitManifestJson: {
      trainRefs: ['episode:episode-specialist-1'],
      validationRefs: [],
      holdoutRefs: [],
    },
    status: 'ready',
    createdAt: '2026-03-26T16:01:00.000Z',
  });

  const persisted = await store.getDataset('dataset-2');
  assert.ok(persisted);
  assert.equal(persisted.sourceManifestJson['secretsExported'], false);
  assert.equal(persisted.sourceManifestJson['unreviewedAutobiographicalProseAllowed'], false);
  assert.deepEqual(persisted.splitManifestJson, {
    trainRefs: ['episode:episode-specialist-1'],
    validationRefs: [],
    holdoutRefs: [],
  });
});
