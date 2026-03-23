import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerceptionController } from '../../src/perception/index.ts';
import {
  buildPerceptionTestConfig,
  createPerceptionTestWorkspace,
} from '../../testing/perception-config.ts';
import { createPerceptionStoreHarness } from '../../testing/perception-store-harness.ts';

void test('AC-F0005-02 normalizes ingest and adapter signals into the canonical perception intake layer', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const admissions: Array<Record<string, unknown>> = [];
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: (input) => {
      admissions.push(input);
      return Promise.resolve({
        accepted: true,
        tickId: 'tick-reactive-1',
      });
    },
    now: (() => {
      let step = 0;
      return () => `2026-03-23T00:00:0${step++}.000Z`;
    })(),
    createId: (() => {
      let step = 0;
      return () => `stimulus-${step++}`;
    })(),
  });

  try {
    const httpResult = await controller.ingestHttpStimulus({
      signalType: 'http.operator.message',
      priority: 'critical',
      requiresImmediateTick: true,
      payload: {
        text: 'operator ping',
      },
      dedupeKey: 'http:operator:1',
    });

    const systemResult = await controller.emitSystemSignal({
      signalType: 'system.boot.completed',
      priority: 'high',
      payload: {
        mode: 'normal',
      },
    });

    assert.equal(httpResult.deduplicated, false);
    assert.equal(systemResult.deduplicated, false);
    assert.equal(admissions.length, 1);

    const storedHttp = storeHarness.stimuli.get(httpResult.stimulusId);
    const storedSystem = storeHarness.stimuli.get(systemResult.stimulusId);
    assert.ok(storedHttp);
    assert.ok(storedSystem);
    assert.equal(storedHttp?.sourceKind, 'http');
    assert.equal(storedHttp?.status, 'queued');
    assert.equal(storedHttp?.normalizedJson.signalType, 'http.operator.message');
    assert.equal(storedSystem?.sourceKind, 'system');
    assert.equal(storedSystem?.normalizedJson.signalType, 'system.boot.completed');
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});
