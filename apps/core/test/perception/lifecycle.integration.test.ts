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

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 3_000,
  intervalMs = 25,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await sleep(intervalMs);
  }

  throw new Error('timed out while waiting for adapter condition');
};

const createTickingNow = () => {
  let step = 0;
  return () => new Date(Date.UTC(2026, 2, 23, 0, 0, step++)).toISOString();
};

void test('AC-F0005-01 starts, stops and restarts real sensor adapters only under runtime lifecycle control', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const adapterWrites = {
    file: 0,
    scheduler: 0,
    resource: 0,
  };
  let resourceSeverity: 'normal' | 'high' | 'critical' = 'normal';
  const trackedStore = {
    ...storeHarness.store,
    enqueueStimulus: async (...args: Parameters<typeof storeHarness.store.enqueueStimulus>) => {
      const source = args[0].envelope.source;
      if (source === 'file' || source === 'scheduler' || source === 'resource') {
        adapterWrites[source] += 1;
      }
      return await storeHarness.store.enqueueStimulus(...args);
    },
    updateQueuedStimulus: async (
      ...args: Parameters<typeof storeHarness.store.updateQueuedStimulus>
    ) => {
      const source = storeHarness.stimuli.get(args[0].stimulusId)?.sourceKind;
      if (source === 'file' || source === 'scheduler' || source === 'resource') {
        adapterWrites[source] += 1;
      }
      return await storeHarness.store.updateQueuedStimulus(...args);
    },
  };
  const watchedRoot = workspace.root;
  const watchedPath = path.join(workspace.root, 'workspace/body');
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: trackedStore,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: true,
        tickId: 'tick-lifecycle-1',
      }),
    now: createTickingNow(),
    testOverrides: {
      filesystemWatchPaths: [watchedPath],
      filesystemRepoRoot: watchedRoot,
      resourceIntervalMs: 25,
      resourceSamplePressure: () => resourceSeverity,
    },
  });

  try {
    const beforeStart = await controller.health();
    assert.equal(
      beforeStart.adapters.find((adapter) => adapter.source === 'system')?.status,
      'disabled',
    );

    await controller.start();
    await sleep(150);
    await writeFile(path.join(watchedPath, 'lifecycle-start.txt'), 'start\n');
    resourceSeverity = 'high';
    await controller.emitSchedulerSignal({
      signalType: 'scheduler.started',
      priority: 'low',
      payload: {
        driver: 'pg-boss',
        phase: 'boot',
      },
      dedupeKey: 'scheduler:started',
    });
    await waitFor(
      () => adapterWrites.file > 0 && adapterWrites.scheduler > 0 && adapterWrites.resource > 0,
    );

    const afterStart = await controller.health();
    assert.equal(
      afterStart.adapters.find((adapter) => adapter.source === 'system')?.status,
      'healthy',
    );
    assert.equal(
      afterStart.adapters.find((adapter) => adapter.source === 'file')?.status,
      'healthy',
    );
    assert.equal(
      afterStart.adapters.find((adapter) => adapter.source === 'scheduler')?.status,
      'healthy',
    );
    assert.equal(
      afterStart.adapters.find((adapter) => adapter.source === 'resource')?.status,
      'healthy',
    );

    const writesAfterStart = { ...adapterWrites };

    await controller.stop();
    resourceSeverity = 'critical';
    await writeFile(path.join(watchedPath, 'lifecycle-stopped.txt'), 'stopped\n');
    await sleep(150);
    await assert.rejects(
      controller.emitSchedulerSignal({
        signalType: 'scheduler.started',
        priority: 'low',
        payload: {
          driver: 'pg-boss',
          phase: 'stopped',
        },
        dedupeKey: 'scheduler:started',
      }),
      /scheduler adapter is not active/,
    );

    assert.deepEqual(adapterWrites, writesAfterStart);

    const afterStop = await controller.health();
    assert.equal(
      afterStop.adapters.find((adapter) => adapter.source === 'system')?.status,
      'disabled',
    );
    assert.equal(
      afterStop.adapters.find((adapter) => adapter.source === 'telegram')?.status,
      'disabled',
    );

    await controller.start();
    await sleep(150);
    await writeFile(path.join(watchedPath, 'lifecycle-restart.txt'), 'restart\n');
    resourceSeverity = 'high';
    await controller.emitSchedulerSignal({
      signalType: 'scheduler.started',
      priority: 'low',
      payload: {
        driver: 'pg-boss',
        phase: 'restart',
      },
      dedupeKey: 'scheduler:started',
    });
    await waitFor(
      () =>
        adapterWrites.file > writesAfterStart.file &&
        adapterWrites.scheduler > writesAfterStart.scheduler &&
        adapterWrites.resource > writesAfterStart.resource,
    );
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});
