import test from 'node:test';
import assert from 'node:assert/strict';
import { createTickRuntimeStore, TICK_STATUS } from '../src/index.ts';
import { createSubjectStateDbHarness } from '../testing/subject-state-db-harness.ts';

void test('AC-F0004-06 reloads the last committed subject-state after restart without process-local reconstruction', async () => {
  const firstProcess = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-23',
        bootStateJson: {},
        currentTickId: 'tick-restart',
        currentModelProfileId: 'model-fast@stable',
        lastStableSnapshotId: 'snapshot-77',
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-23T00:00:00.000Z',
      },
      ticks: {
        'tick-restart': {
          tickId: 'tick-restart',
          agentId: 'polyphony-core',
          requestId: 'request-restart',
          tickKind: 'wake',
          triggerKind: 'boot',
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
        },
      },
    },
  });
  const firstStore = createTickRuntimeStore(firstProcess.db);

  await firstStore.completeTick({
    tickId: 'tick-restart',
    occurredAt: new Date('2026-03-23T00:00:03.000Z'),
    summary: 'restart snapshot',
    resultJson: { ok: true },
    subjectStateDelta: {
      agentStatePatch: {
        psmJson: { continuityMarker: 'persisted' },
        resourcePostureJson: { memory: 'nominal' },
      },
      goalUpserts: [
        {
          goalId: 'goal-restart',
          title: 'Reload after restart',
          status: 'active',
          priority: 6,
          goalType: 'continuity',
          evidenceRefs: [{ kind: 'tick', tickId: 'tick-restart' }],
        },
      ],
    },
  });

  const secondProcess = createSubjectStateDbHarness({
    seed: structuredClone(firstProcess.state),
  });
  const secondStore = createTickRuntimeStore(secondProcess.db);

  const snapshot = await secondStore.loadSubjectStateSnapshot();

  assert.equal(snapshot.agentState.currentTickId, null);
  assert.equal(snapshot.agentState.currentModelProfileId, 'model-fast@stable');
  assert.equal(snapshot.agentState.lastStableSnapshotId, 'snapshot-77');
  assert.equal(snapshot.agentState.psmJson['continuityMarker'], 'persisted');
  assert.equal(snapshot.agentState.resourcePostureJson['memory'], 'nominal');
  assert.deepEqual(
    snapshot.goals.map((goal) => goal.goalId),
    ['goal-restart'],
  );
});
