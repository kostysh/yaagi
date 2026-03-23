import test from 'node:test';
import assert from 'node:assert/strict';
import { STIMULUS_PRIORITY } from '@yaagi/contracts/perception';
import { createPerceptionStore, createTickRuntimeStore, TICK_STATUS } from '../src/index.ts';
import { createSubjectStateDbHarness } from '../testing/subject-state-db-harness.ts';

void test('AC-F0005-03 stores and orders queued stimuli deterministically inside stimulus_inbox', async () => {
  const harness = createSubjectStateDbHarness();
  const store = createPerceptionStore(harness.db);

  await store.enqueueStimulus({
    envelope: {
      id: 'stimulus-low',
      source: 'http',
      occurredAt: '2026-03-23T00:00:03.000Z',
      priority: STIMULUS_PRIORITY.LOW,
      threadId: null,
      entityRefs: [],
      requiresImmediateTick: false,
      payload: { text: 'low' },
      reliability: 1,
    },
    signalType: 'http.note',
  });
  await store.enqueueStimulus({
    envelope: {
      id: 'stimulus-critical',
      source: 'system',
      occurredAt: '2026-03-23T00:00:02.000Z',
      priority: STIMULUS_PRIORITY.CRITICAL,
      threadId: null,
      entityRefs: [],
      requiresImmediateTick: true,
      payload: { text: 'critical' },
      reliability: 1,
    },
    signalType: 'system.alert',
    dedupeKey: 'system:alert',
  });
  await store.enqueueStimulus({
    envelope: {
      id: 'stimulus-high',
      source: 'telegram',
      occurredAt: '2026-03-23T00:00:01.000Z',
      priority: STIMULUS_PRIORITY.HIGH,
      threadId: '12345',
      entityRefs: [],
      requiresImmediateTick: false,
      payload: { text: 'high' },
      reliability: 1,
    },
    signalType: 'telegram.message',
    dedupeKey: 'telegram:update:1',
  });

  const ready = await store.loadReadyStimuli({ limit: 10 });
  const counts = await store.countBacklog();
  const telegram = await store.findLatestBySourceAndDedupeKey({
    sourceKind: 'telegram',
    dedupeKey: 'telegram:update:1',
  });

  assert.deepEqual(
    ready.map((stimulus) => stimulus.stimulusId),
    ['stimulus-critical', 'stimulus-high', 'stimulus-low'],
  );
  assert.deepEqual(counts, {
    queued: 3,
    claimed: 0,
    consumed: 0,
    dropped: 0,
  });
  assert.equal(telegram?.stimulusId, 'stimulus-high');
  assert.equal(telegram?.occurredAt, '2026-03-23T00:00:01.000Z');
  assert.equal(ready[0]?.occurredAt, '2026-03-23T00:00:02.000Z');
});

void test('AC-F0005-06 consumes or releases claimed stimuli atomically with tick finalization and stale reclaim', async () => {
  const activeTickId = 'tick-reactive-active';
  const staleTickId = 'tick-reactive-stale';
  const baseTick = {
    agentId: 'polyphony-core',
    tickKind: 'reactive' as const,
    triggerKind: 'system' as const,
    status: TICK_STATUS.STARTED,
    queuedAt: '2026-03-23T00:00:00.000Z',
    startedAt: '2026-03-23T00:00:00.000Z',
    endedAt: null,
    leaseOwner: 'core',
    requestJson: {},
    resultJson: {},
    failureJson: {},
    continuityFlagsJson: {},
    selectedCoalitionId: null,
    selectedModelProfileId: null,
    actionId: null,
    createdAt: '2026-03-23T00:00:00.000Z',
    updatedAt: '2026-03-23T00:00:00.000Z',
  };
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-23',
        bootStateJson: {},
        currentTickId: activeTickId,
        currentModelProfileId: null,
        lastStableSnapshotId: null,
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-23T00:00:00.000Z',
      },
      ticks: {
        [activeTickId]: {
          ...baseTick,
          tickId: activeTickId,
          requestId: 'active-request',
          leaseExpiresAt: '2026-03-23T00:01:00.000Z',
        },
        [staleTickId]: {
          ...baseTick,
          tickId: staleTickId,
          requestId: 'stale-request',
          startedAt: '2026-03-23T00:00:01.000Z',
          queuedAt: '2026-03-23T00:00:01.000Z',
          leaseExpiresAt: '2026-03-23T00:00:10.000Z',
        },
      },
    },
  });

  const perceptionStore = createPerceptionStore(harness.db);
  const tickStore = createTickRuntimeStore(harness.db);

  await perceptionStore.enqueueStimulus({
    envelope: {
      id: 'stimulus-complete',
      source: 'http',
      occurredAt: '2026-03-23T00:00:02.000Z',
      priority: STIMULUS_PRIORITY.NORMAL,
      threadId: null,
      entityRefs: [],
      requiresImmediateTick: false,
      payload: {},
      reliability: 1,
    },
    signalType: 'http.note',
  });
  await perceptionStore.enqueueStimulus({
    envelope: {
      id: 'stimulus-failed',
      source: 'system',
      occurredAt: '2026-03-23T00:00:03.000Z',
      priority: STIMULUS_PRIORITY.HIGH,
      threadId: null,
      entityRefs: [],
      requiresImmediateTick: false,
      payload: {},
      reliability: 1,
    },
    signalType: 'system.alert',
  });

  await perceptionStore.claimStimuli({
    tickId: activeTickId,
    stimulusIds: ['stimulus-complete'],
  });
  await perceptionStore.attachTickPerceptionClaim({
    tickId: activeTickId,
    claim: {
      tickId: activeTickId,
      items: [],
      sourceKinds: ['http'],
      claimedStimulusIds: ['stimulus-complete'],
      requiresImmediateTick: false,
      highestPriority: STIMULUS_PRIORITY.NORMAL,
    },
  });

  await tickStore.completeTick({
    tickId: activeTickId,
    occurredAt: new Date('2026-03-23T00:00:04.000Z'),
    summary: 'completed with claimed stimuli',
    resultJson: { ok: true },
  });

  assert.equal(harness.state.stimuli['stimulus-complete']?.status, 'consumed');

  await perceptionStore.claimStimuli({
    tickId: staleTickId,
    stimulusIds: ['stimulus-failed'],
  });
  await perceptionStore.attachTickPerceptionClaim({
    tickId: staleTickId,
    claim: {
      tickId: staleTickId,
      items: [],
      sourceKinds: ['system'],
      claimedStimulusIds: ['stimulus-failed'],
      requiresImmediateTick: false,
      highestPriority: STIMULUS_PRIORITY.HIGH,
    },
  });

  const reclaimed = await tickStore.reclaimStaleTicks({
    now: new Date('2026-03-23T00:02:00.000Z'),
  });

  assert.equal(reclaimed, 1);
  assert.equal(harness.state.stimuli['stimulus-failed']?.status, 'queued');
  assert.equal(harness.state.stimuli['stimulus-failed']?.claimTickId, null);
});
