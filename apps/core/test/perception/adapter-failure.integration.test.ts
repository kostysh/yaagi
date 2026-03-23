import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createPerceptionController } from '../../src/perception/index.ts';
import {
  buildPerceptionTestConfig,
  createPerceptionTestWorkspace,
} from '../../testing/perception-config.ts';
import { createPerceptionStoreHarness } from '../../testing/perception-store-harness.ts';

void test('AC-F0005-05 degrades failing adapter sources without crashing core', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root, {
      telegramEnabled: true,
      telegramBotToken: 'token',
      telegramAllowedChatIds: ['12345'],
      telegramApiBaseUrl: 'http://127.0.0.1:65530',
    }),
    store: storeHarness.store,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: true,
        tickId: 'tick-http-1',
      }),
  });

  try {
    await controller.start();
    await sleep(400);
    await controller.ingestHttpStimulus({
      signalType: 'http.operator.message',
      payload: { text: 'http still works' },
    });

    const health = await controller.health();
    const telegram = health.adapters.find((adapter) => adapter.source === 'telegram');
    const http = health.adapters.find((adapter) => adapter.source === 'http');

    assert.ok(telegram);
    assert.equal(telegram?.status, 'degraded');
    assert.ok(http);
    assert.equal(http?.status, 'healthy');
    assert.equal(storeHarness.stimuli.size, 1);
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});
