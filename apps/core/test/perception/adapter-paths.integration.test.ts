import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { createPerceptionController } from '../../src/perception/index.ts';
import {
  buildPerceptionTestConfig,
  createPerceptionTestWorkspace,
} from '../../testing/perception-config.ts';
import { createPerceptionStoreHarness } from '../../testing/perception-store-harness.ts';

const waitForRecord = async <T>(
  producer: () => T | undefined,
  timeoutMs = 3_000,
  intervalMs = 25,
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = producer();
    if (value !== undefined) {
      return value;
    }
    await sleep(intervalMs);
  }

  throw new Error('timed out while waiting for a persisted stimulus');
};

void test('AC-F0005-02 normalizes filesystem adapter events into the canonical perception intake layer', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const watchedPath = path.join(workspace.root, 'workspace/body');
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: true,
        tickId: 'tick-file-adapter',
      }),
    testOverrides: {
      filesystemWatchPaths: [watchedPath],
      filesystemRepoRoot: workspace.root,
    },
  });

  try {
    await controller.start();
    await sleep(150);
    await writeFile(path.join(watchedPath, 'adapter-file.txt'), 'file adapter\n');

    const stimulus = await waitForRecord(() =>
      [...storeHarness.stimuli.values()].find((row) => row.sourceKind === 'file'),
    );

    assert.equal(stimulus.status, 'queued');
    assert.match(stimulus.normalizedJson.signalType, /^filesystem\./);
    assert.equal(stimulus.payloadJson['path'], 'workspace/body/adapter-file.txt');
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});

void test('AC-F0005-02 normalizes scheduler runtime-hook signals into the canonical perception intake layer', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: true,
        tickId: 'tick-scheduler-adapter',
      }),
  });

  try {
    await controller.start();
    const result = await controller.emitSchedulerSignal({
      signalType: 'scheduler.started',
      priority: 'low',
      payload: {
        driver: 'pg-boss',
        phase: 'boot',
      },
      dedupeKey: 'scheduler:started',
    });

    const stimulus = await waitForRecord(() =>
      [...storeHarness.stimuli.values()].find((row) => row.sourceKind === 'scheduler'),
    );

    assert.equal(result.stimulusId, stimulus.stimulusId);
    assert.equal(stimulus.status, 'queued');
    assert.equal(stimulus.normalizedJson.signalType, 'scheduler.started');
    assert.equal(stimulus.dedupeKey, 'scheduler:started');
    assert.equal(stimulus.payloadJson['driver'], 'pg-boss');
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});

void test('AC-F0005-02 normalizes resource adapter pressure signals into the canonical perception intake layer', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: true,
        tickId: 'tick-resource-adapter',
      }),
    testOverrides: {
      resourceIntervalMs: 25,
      resourceSamplePressure: () => 'high',
    },
  });

  try {
    await controller.start();

    const stimulus = await waitForRecord(() =>
      [...storeHarness.stimuli.values()].find((row) => row.sourceKind === 'resource'),
    );

    assert.equal(stimulus.status, 'queued');
    assert.equal(stimulus.normalizedJson.signalType, 'resource.pressure');
    assert.equal(stimulus.priority, 'high');
    assert.equal(stimulus.payloadJson['severity'], 'high');
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});
