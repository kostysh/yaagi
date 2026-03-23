import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerceptionController } from '../../src/perception/index.ts';
import {
  buildPerceptionTestConfig,
  createPerceptionTestWorkspace,
} from '../../testing/perception-config.ts';
import { createPerceptionStoreHarness } from '../../testing/perception-store-harness.ts';

void test('AC-F0005-03 builds a bounded deterministic perception batch with coalescing and claim semantics', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: true,
        tickId: 'tick-reactive-claim',
      }),
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
    await controller.ingestSignal({
      source: 'file',
      signalType: 'filesystem.change',
      occurredAt: '2026-03-23T00:00:03.000Z',
      priority: 'normal',
      payload: { path: 'workspace/body/a.ts' },
      dedupeKey: 'filesystem:workspace/body/a.ts',
    });
    await controller.ingestSignal({
      source: 'file',
      signalType: 'filesystem.change',
      occurredAt: '2026-03-23T00:00:02.000Z',
      priority: 'high',
      payload: { path: 'workspace/body/a.ts' },
      dedupeKey: 'filesystem:workspace/body/a.ts',
    });
    await controller.ingestSignal({
      source: 'telegram',
      signalType: 'telegram.message',
      occurredAt: '2026-03-23T00:00:01.000Z',
      priority: 'critical',
      requiresImmediateTick: true,
      threadId: '12345',
      payload: { text: 'operator ping' },
      dedupeKey: 'telegram:update:1',
    });

    const batch = await controller.prepareReactiveTick('tick-reactive-claim');
    const queuedAfterClaim = [...storeHarness.stimuli.values()].filter(
      (stimulus) => stimulus.status === 'queued',
    );
    const mergedFileStimulus = [...storeHarness.stimuli.values()].find(
      (stimulus) => stimulus.sourceKind === 'file',
    );

    assert.equal(batch.tickId, 'tick-reactive-claim');
    assert.equal(batch.items.length, 2);
    assert.deepEqual(
      batch.items.map((item) => item.primaryStimulusId),
      ['stimulus-2', 'stimulus-0'],
    );
    assert.deepEqual(batch.claimedStimulusIds, ['stimulus-2', 'stimulus-0']);
    assert.equal(batch.items[1]?.coalescedCount, 1);
    assert.equal(batch.items[1]?.priority, 'high');
    assert.equal(mergedFileStimulus?.priority, 'high');
    assert.equal(storeHarness.stimuli.size, 2);
    assert.equal(queuedAfterClaim.length, 0);
    assert.equal(storeHarness.tickClaims.get('tick-reactive-claim')?.claimedStimulusIds.length, 2);
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});

void test('AC-F0005-04 reuses only the canonical reactive requestTick path for urgent stimuli', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const admissions: string[] = [];
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: (input) => {
      admissions.push(input.requestId);
      return Promise.resolve({
        accepted: false,
        reason: 'lease_busy',
      });
    },
    createId: () => 'stimulus-urgent',
  });

  try {
    const result = await controller.ingestSignal({
      source: 'telegram',
      signalType: 'telegram.message',
      priority: 'critical',
      requiresImmediateTick: true,
      payload: { text: 'busy' },
      dedupeKey: 'telegram:update:lease-busy',
    });

    assert.equal(admissions.length, 1);
    assert.equal(result.tickAdmission?.accepted, false);
    assert.equal(result.tickAdmission?.reason, 'lease_busy');
    assert.equal(storeHarness.stimuli.get(result.stimulusId)?.status, 'queued');
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});

void test('AC-F0005-04 requests a reactive tick when a queued duplicate is upgraded to urgent', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const admissions: string[] = [];
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: (input) => {
      admissions.push(input.requestId);
      return Promise.resolve({
        accepted: true,
        tickId: 'tick-reactive-upgraded',
      });
    },
    createId: (() => {
      let step = 0;
      return () => `resource-upgrade-${step++}`;
    })(),
  });

  try {
    const first = await controller.ingestSignal({
      source: 'resource',
      signalType: 'resource.pressure',
      priority: 'high',
      payload: { severity: 'high' },
      dedupeKey: 'resource:pressure',
    });

    const second = await controller.ingestSignal({
      source: 'resource',
      signalType: 'resource.pressure',
      priority: 'critical',
      requiresImmediateTick: true,
      payload: { severity: 'critical' },
      dedupeKey: 'resource:pressure',
    });

    const merged = storeHarness.stimuli.get(first.stimulusId);

    assert.equal(first.deduplicated, false);
    assert.equal(second.deduplicated, true);
    assert.equal(second.stimulusId, first.stimulusId);
    assert.equal(second.tickAdmission?.accepted, true);
    assert.deepEqual(admissions, [`perception:${first.stimulusId}`]);
    assert.equal(merged?.priority, 'critical');
    assert.equal(merged?.requiresImmediateTick, true);
    assert.equal(storeHarness.stimuli.size, 1);
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});

void test('AC-F0005-03 re-queues a stronger duplicate when the previous stimulus is already claimed', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: true,
        tickId: 'tick-reactive-pressure',
      }),
    createId: (() => {
      let step = 0;
      return () => `pressure-stimulus-${step++}`;
    })(),
  });

  try {
    const first = await controller.ingestSignal({
      source: 'resource',
      signalType: 'resource.pressure',
      priority: 'high',
      payload: { severity: 'high' },
      dedupeKey: 'resource:pressure',
    });

    await controller.prepareReactiveTick('tick-reactive-pressure');

    const second = await controller.ingestSignal({
      source: 'resource',
      signalType: 'resource.pressure',
      priority: 'critical',
      requiresImmediateTick: true,
      payload: { severity: 'critical' },
      dedupeKey: 'resource:pressure',
    });

    assert.equal(first.deduplicated, false);
    assert.equal(second.deduplicated, false);
    assert.notEqual(second.stimulusId, first.stimulusId);
    assert.equal(storeHarness.stimuli.get(first.stimulusId)?.status, 'claimed');
    assert.equal(storeHarness.stimuli.get(second.stimulusId)?.status, 'queued');
    assert.equal(storeHarness.stimuli.get(second.stimulusId)?.priority, 'critical');
    assert.equal(storeHarness.stimuli.size, 2);
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});
