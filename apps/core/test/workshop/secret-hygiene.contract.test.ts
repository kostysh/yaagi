import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { createWorkshopServiceHarness } from '../../testing/workshop-fixture.ts';
import { createSecretHygieneGuard } from '../../src/security/secret-hygiene.ts';
import { createWorkshopService } from '../../src/workshop/service.ts';

void test('AC-F0018-08 / AC-F0018-09 fail closed before dataset export when payload contains configured secret material', async () => {
  const harness = await createWorkshopServiceHarness();
  const service = createWorkshopService({
    store: harness.store,
    dataPath: path.join(harness.root, 'data'),
    modelsPath: path.join(harness.root, 'models'),
    createId: (() => {
      let index = 0;
      return () => `secret-guard-${++index}`;
    })(),
    secretHygieneGuard: createSecretHygieneGuard(
      {
        telegramBotToken: 'smoke-token',
      },
      {
        explicitSecretValues: ['smoke-token'],
      },
    ),
  });

  try {
    await assert.rejects(
      () =>
        service.buildDataset({
          requestId: 'dataset-secret-1',
          datasetKind: 'sft',
          sourceEpisodeIds: ['episode:contains-smoke-token'],
          sourceEvalRunIds: [],
          sourceHumanLabelIds: [],
          redactionProfile: 'episodes-redacted-v1',
        }),
      /secret hygiene/i,
    );

    await assert.rejects(
      access(path.join(harness.root, 'data', 'datasets', 'secret-guard-1', 'manifest.json')),
    );
    assert.equal(
      harness.state.datasetsById['secret-guard-1']?.sourceManifestJson['manifestUri'],
      'urn:yaagi:artifact-write-failed:manifest.json',
    );
  } finally {
    await harness.cleanup();
  }
});
