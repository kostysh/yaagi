import test from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_MODE } from '@yaagi/contracts/cognition';
import { createTickRuntimeStore } from '@yaagi/db';
import { buildDecisionContext } from '../../src/cognition/index.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

void test('AC-F0009-01 builds canonical bounded decision context from delivered owner surfaces', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-24',
        bootStateJson: {},
        currentTickId: 'tick-reactive-context',
        currentModelProfileId: 'reflex.fast@baseline',
        lastStableSnapshotId: null,
        psmJson: {
          currentFocus: 'operator ingress',
        },
        resourcePostureJson: {
          pressure: 0.6,
          memory: 'steady',
        },
        developmentFreeze: false,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
      goals: {
        'goal-operator-reply': {
          goalId: 'goal-operator-reply',
          title: 'Reply to operator',
          status: 'active',
          priority: 100,
          goalType: 'interaction',
          parentGoalId: null,
          rationaleJson: {},
          evidenceRefs: [],
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
      },
      beliefs: {
        'belief-operator-thread': {
          beliefId: 'belief-operator-thread',
          topic: 'operator',
          proposition: 'the operator is waiting for a reply',
          confidence: 0.9,
          status: 'active',
          evidenceRefs: [],
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
      },
      entities: {
        'entity-operator': {
          entityId: 'entity-operator',
          entityKind: 'person',
          canonicalName: 'Operator',
          stateJson: {},
          trustJson: {},
          lastSeenAt: '2026-03-24T00:00:00.000Z',
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
      },
      relationships: {
        'entity-operator|polyphony-core|operator_of': {
          srcEntityId: 'entity-operator',
          dstEntityId: 'polyphony-core',
          relationKind: 'operator_of',
          confidence: 0.8,
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
      },
      episodesById: {
        'episode-1': {
          episodeId: 'episode-1',
          tickId: 'tick-1',
          summary: 'handled previous operator message',
          resultJson: {
            outcome: 'completed',
          },
          createdAt: '2026-03-24T00:00:00.000Z',
        },
      },
    },
  });
  const store = createTickRuntimeStore(harness.db);
  const snapshot = await store.loadSubjectStateSnapshot({
    goalLimit: 10,
    beliefLimit: 10,
    entityLimit: 10,
    relationshipLimit: 10,
  });
  const recentEpisodes = await store.listRecentEpisodes({ limit: 5 });

  const built = buildDecisionContext({
    tickId: 'tick-reactive-context',
    decisionMode: DECISION_MODE.REACTIVE,
    selectedModelProfileId: 'reflex.fast@baseline',
    selectedRole: 'reflex',
    subjectStateSnapshot: snapshot,
    recentEpisodes,
    perceptionBatch: {
      tickId: 'tick-reactive-context',
      claimedStimulusIds: ['stimulus-1'],
      highestPriority: 'critical',
      requiresImmediateTick: true,
      sourceKinds: ['http'],
      items: [
        {
          stimulusIds: ['stimulus-1'],
          primaryStimulusId: 'stimulus-1',
          source: 'http',
          signalType: 'http.operator.message',
          occurredAt: '2026-03-24T00:00:00.000Z',
          priority: 'critical',
          requiresImmediateTick: true,
          threadId: 'operator-http',
          entityRefs: ['entity-operator'],
          payload: {
            text: 'hello',
          },
          dedupeKey: null,
          coalescedCount: 1,
        },
      ],
    },
  });

  assert.equal(built.accepted, true);
  if (!built.accepted) {
    return;
  }

  assert.equal(built.context.tickId, 'tick-reactive-context');
  assert.equal(built.context.selectedModelProfileId, 'reflex.fast@baseline');
  assert.equal(built.context.selectedRole, 'reflex');
  assert.equal(built.context.subjectState.subjectStateSchemaVersion, '2026-03-24');
  assert.equal(built.context.perceptualContext.summary, '1 claimed stimuli (http:1)');
  assert.equal(built.context.perceptualMeta.sourceIds[0], 'stimulus-1');
  assert.equal(built.context.subjectState.agentState['agentId'], 'polyphony-core');
  assert.deepEqual(
    built.context.recentEpisodes.map((episode) => episode.episodeId),
    ['episode-1'],
  );
  assert.equal(built.context.resourcePostureJson['pressure'], 0.6);

  const telegramBuilt = buildDecisionContext({
    tickId: 'tick-reactive-context',
    decisionMode: DECISION_MODE.REACTIVE,
    selectedModelProfileId: 'reflex.fast@baseline',
    selectedRole: 'reflex',
    subjectStateSnapshot: snapshot,
    recentEpisodes,
    perceptionBatch: {
      tickId: 'tick-reactive-context',
      claimedStimulusIds: ['telegram-stimulus-1'],
      highestPriority: 'high',
      requiresImmediateTick: true,
      sourceKinds: ['telegram'],
      items: [
        {
          stimulusIds: ['telegram-stimulus-1'],
          primaryStimulusId: 'telegram-stimulus-1',
          source: 'telegram',
          signalType: 'telegram.message',
          occurredAt: '2026-03-24T00:00:00.000Z',
          priority: 'high',
          requiresImmediateTick: true,
          threadId: '12345',
          entityRefs: [],
          payload: {
            updateId: 77,
            chatType: 'private',
            text: 'answer with one short acknowledgement',
          },
          dedupeKey: 'telegram:update:77',
          coalescedCount: 1,
        },
      ],
    },
  });

  assert.equal(telegramBuilt.accepted, true);
  if (!telegramBuilt.accepted) {
    return;
  }

  assert.equal(
    telegramBuilt.context.perceptualContext.summary,
    '1 claimed stimuli (telegram:1); telegram.private stimulus telegram-stimulus-1 updateId=77 text="answer with one short acknowledgement"',
  );
});
