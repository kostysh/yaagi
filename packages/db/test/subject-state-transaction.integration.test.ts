import test from 'node:test';
import assert from 'node:assert/strict';
import { createTickRuntimeStore, TICK_STATUS } from '../src/index.ts';
import { createSubjectStateDbHarness } from '../testing/subject-state-db-harness.ts';

const startedTick = {
  tickId: 'tick-f0004-active',
  agentId: 'polyphony-core',
  requestId: 'request-f0004-active',
  tickKind: 'reactive' as const,
  triggerKind: 'system' as const,
  status: TICK_STATUS.STARTED,
  queuedAt: '2026-03-23T00:00:00.000Z',
  startedAt: '2026-03-23T00:00:00.000Z',
  endedAt: null,
  leaseOwner: 'core',
  leaseExpiresAt: '2026-03-23T00:01:00.000Z',
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

void test('AC-F0004-03 commits or rolls back subject-state mutations atomically with terminal tick outcome', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-23',
        bootStateJson: {},
        currentTickId: startedTick.tickId,
        currentModelProfileId: null,
        lastStableSnapshotId: null,
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-23T00:00:00.000Z',
      },
      ticks: {
        [startedTick.tickId]: startedTick,
      },
    },
  });
  const store = createTickRuntimeStore(harness.db);

  const completion = await store.completeTick({
    tickId: startedTick.tickId,
    occurredAt: new Date('2026-03-23T00:00:05.000Z'),
    summary: 'subject state committed',
    resultJson: { ok: true },
    subjectStateDelta: {
      agentStatePatch: {
        psmJson: {
          committedMarker: 'tick-completed',
        },
      },
      goalUpserts: [
        {
          goalId: 'goal-runtime',
          title: 'Protect runtime continuity',
          status: 'active',
          priority: 7,
          goalType: 'continuity',
          evidenceRefs: [{ kind: 'tick', tickId: startedTick.tickId }],
        },
      ],
      beliefUpserts: [
        {
          beliefId: 'belief-runtime',
          topic: 'runtime',
          proposition: 'completed ticks may mutate subject state',
          confidence: 0.8,
          status: 'active',
          evidenceRefs: [{ kind: 'episode', episodeId: 'pending' }],
        },
      ],
      entityUpserts: [
        {
          entityId: 'entity-runtime',
          entityKind: 'service',
          canonicalName: 'Runtime Core',
          stateJson: { healthy: true },
          trustJson: { confidence: 1 },
          lastSeenAt: '2026-03-23T00:00:05.000Z',
        },
      ],
      relationshipUpserts: [
        {
          srcEntityId: 'entity-runtime',
          dstEntityId: 'entity-runtime',
          relationKind: 'self',
          confidence: 1,
        },
      ],
    },
  });

  assert.equal(completion.tick.status, TICK_STATUS.COMPLETED);
  assert.ok(completion.episode.episodeId);
  assert.equal(harness.state.agentState?.currentTickId, null);
  assert.equal(harness.state.agentState?.psmJson['committedMarker'], 'tick-completed');
  assert.ok(harness.state.goals['goal-runtime']);
  assert.ok(harness.state.beliefs['belief-runtime']);
  assert.ok(harness.state.entities['entity-runtime']);
  assert.ok(harness.state.relationships['entity-runtime|entity-runtime|self']);

  const rollbackHarness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-23',
        bootStateJson: {},
        currentTickId: startedTick.tickId,
        currentModelProfileId: null,
        lastStableSnapshotId: null,
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-23T00:00:00.000Z',
      },
      ticks: {
        [startedTick.tickId]: structuredClone(startedTick),
      },
    },
  });
  rollbackHarness.failOnSqlFragment('insert into polyphony_runtime.relationships');
  const rollbackStore = createTickRuntimeStore(rollbackHarness.db);

  await assert.rejects(
    rollbackStore.completeTick({
      tickId: startedTick.tickId,
      occurredAt: new Date('2026-03-23T00:00:06.000Z'),
      summary: 'must rollback',
      resultJson: { ok: false },
      subjectStateDelta: {
        agentStatePatch: {
          psmJson: { committedMarker: 'should-not-persist' },
        },
        entityUpserts: [
          {
            entityId: 'entity-rollback',
            entityKind: 'service',
            canonicalName: 'Rollback',
          },
        ],
        relationshipUpserts: [
          {
            srcEntityId: 'entity-rollback',
            dstEntityId: 'entity-rollback',
            relationKind: 'self',
            confidence: 1,
          },
        ],
      },
    }),
    /forced harness failure/,
  );

  assert.equal(rollbackHarness.state.ticks[startedTick.tickId]?.status, TICK_STATUS.STARTED);
  assert.equal(Object.keys(rollbackHarness.state.episodesById).length, 0);
  assert.equal(rollbackHarness.state.agentState?.currentTickId, startedTick.tickId);
  assert.deepEqual(rollbackHarness.state.agentState?.psmJson, {});
  assert.equal(Object.keys(rollbackHarness.state.entities).length, 0);
});
