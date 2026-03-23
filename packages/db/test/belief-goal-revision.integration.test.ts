import test from 'node:test';
import assert from 'node:assert/strict';
import { createTickRuntimeStore } from '../src/index.ts';
import { createSubjectStateDbHarness } from '../testing/subject-state-db-harness.ts';

void test('AC-F0004-05 preserves goal and belief traceability through status and evidence refs', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      goals: {
        'goal-shared': {
          goalId: 'goal-shared',
          title: 'Protect continuity',
          status: 'active',
          priority: 3,
          goalType: 'continuity',
          parentGoalId: null,
          rationaleJson: { source: 'boot' },
          evidenceRefs: [{ kind: 'tick', tickId: 'tick-1' }],
          updatedAt: '2026-03-23T00:00:00.000Z',
        },
      },
      beliefs: {
        'belief-shared': {
          beliefId: 'belief-shared',
          topic: 'runtime',
          proposition: 'postgres is healthy',
          confidence: 0.6,
          status: 'candidate',
          evidenceRefs: [{ kind: 'episode', episodeId: 'episode-1' }],
          updatedAt: '2026-03-23T00:00:00.000Z',
        },
      },
      ticks: {
        'tick-2': {
          tickId: 'tick-2',
          agentId: 'polyphony-core',
          requestId: 'request-2',
          tickKind: 'reactive',
          triggerKind: 'system',
          status: 'completed',
          queuedAt: '2026-03-23T00:00:01.000Z',
          startedAt: '2026-03-23T00:00:01.000Z',
          endedAt: '2026-03-23T00:00:02.000Z',
          leaseOwner: 'core',
          leaseExpiresAt: '2026-03-23T00:01:01.000Z',
          requestJson: {},
          resultJson: {},
          failureJson: {},
          continuityFlagsJson: {},
          selectedCoalitionId: null,
          selectedModelProfileId: null,
          actionId: null,
          createdAt: '2026-03-23T00:00:01.000Z',
          updatedAt: '2026-03-23T00:00:02.000Z',
        },
      },
      episodesById: {
        'episode-2': {
          episodeId: 'episode-2',
          tickId: 'tick-2',
          summary: 'episode 2',
          resultJson: {},
          createdAt: '2026-03-23T00:00:02.000Z',
        },
      },
    },
  });
  const store = createTickRuntimeStore(harness.db);

  await store.applyTickStateDelta({
    tickId: 'tick-2',
    terminalStatus: 'completed',
    episodeId: 'episode-2',
    delta: {
      goalUpserts: [
        {
          goalId: 'goal-shared',
          title: 'Protect continuity',
          status: 'blocked',
          priority: 9,
          goalType: 'continuity',
          evidenceRefs: [
            { kind: 'tick', tickId: 'tick-1' },
            { kind: 'tick', tickId: 'tick-2' },
            { kind: 'tick', tickId: 'tick-2' },
          ],
        },
      ],
      beliefUpserts: [
        {
          beliefId: 'belief-shared',
          topic: 'runtime',
          proposition: 'postgres stayed healthy',
          confidence: 0.95,
          status: 'active',
          evidenceRefs: [
            { kind: 'episode', episodeId: 'episode-1' },
            { kind: 'episode', episodeId: 'episode-2' },
            { kind: 'episode', episodeId: 'episode-2' },
          ],
        },
      ],
    },
  });

  await store.applyTickStateDelta({
    tickId: 'tick-2',
    terminalStatus: 'completed',
    episodeId: 'episode-2',
    delta: {
      goalUpserts: [
        {
          goalId: 'goal-shared',
          title: 'Protect continuity',
          status: 'blocked',
          priority: 9,
          goalType: 'continuity',
          evidenceRefs: [{ kind: 'tick', tickId: 'tick-2' }],
        },
      ],
      beliefUpserts: [
        {
          beliefId: 'belief-shared',
          topic: 'runtime',
          proposition: 'postgres stayed healthy',
          confidence: 0.95,
          status: 'active',
          evidenceRefs: [{ kind: 'episode', episodeId: 'episode-2' }],
        },
      ],
    },
  });

  const goal = harness.state.goals['goal-shared'];
  const belief = harness.state.beliefs['belief-shared'];

  assert.ok(goal);
  assert.ok(belief);
  assert.equal(goal.goalId, 'goal-shared');
  assert.equal(goal.status, 'blocked');
  assert.equal(goal.priority, 9);
  assert.deepEqual(goal.evidenceRefs, [
    { kind: 'tick', tickId: 'tick-1' },
    { kind: 'tick', tickId: 'tick-2' },
  ]);
  assert.equal(belief.beliefId, 'belief-shared');
  assert.equal(belief.status, 'active');
  assert.equal(belief.confidence, 0.95);
  assert.deepEqual(belief.evidenceRefs, [
    { kind: 'episode', episodeId: 'episode-1' },
    { kind: 'episode', episodeId: 'episode-2' },
  ]);
});
