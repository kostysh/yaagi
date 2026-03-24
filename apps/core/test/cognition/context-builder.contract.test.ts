import test from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_MODE } from '@yaagi/contracts/cognition';
import {
  buildDecisionContext,
  type DecisionContextBuildInput,
} from '../../src/cognition/index.ts';

const subjectStateSnapshot = {
  subjectStateSchemaVersion: '2026-03-24',
  agentState: {
    agentId: 'polyphony-core',
    mode: 'normal' as const,
    currentTickId: null,
    currentModelProfileId: null,
    lastStableSnapshotId: null,
    psmJson: {},
    resourcePostureJson: {
      pressure: 0.2,
    },
  },
  goals: [
    {
      goalId: 'goal-1',
      title: 'Goal 1',
      status: 'active' as const,
      priority: 10,
      goalType: 'interaction',
      parentGoalId: null,
      rationaleJson: {},
      evidenceRefs: [],
      updatedAt: '2026-03-24T00:00:00.000Z',
    },
  ],
  beliefs: [
    {
      beliefId: 'belief-1',
      topic: 'operator',
      proposition: 'operator asked a question',
      confidence: 0.7,
      status: 'active' as const,
      evidenceRefs: [],
      updatedAt: '2026-03-24T00:00:00.000Z',
    },
  ],
  entities: [
    {
      entityId: 'entity-1',
      entityKind: 'person',
      canonicalName: 'Operator',
      stateJson: {},
      trustJson: {},
      lastSeenAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
    },
  ],
  relationships: [
    {
      srcEntityId: 'entity-1',
      dstEntityId: 'polyphony-core',
      relationKind: 'operator_of',
      confidence: 0.8,
      updatedAt: '2026-03-24T00:00:00.000Z',
    },
  ],
};

void test('AC-F0009-02 carries explicit version, truncation and conflict markers for bounded context sections', () => {
  const partialPerceptionBatch: NonNullable<DecisionContextBuildInput['perceptionBatch']> & {
    truncated: boolean;
    conflictMarkers: string[];
  } = {
    tickId: 'tick-contract',
    claimedStimulusIds: ['stimulus-1'],
    highestPriority: 'high',
    requiresImmediateTick: true,
    sourceKinds: ['system'],
    truncated: true,
    conflictMarkers: ['perception_partial_claim'],
    items: [
      {
        stimulusIds: ['stimulus-1'],
        primaryStimulusId: 'stimulus-1',
        source: 'system',
        signalType: 'system.notice',
        occurredAt: '2026-03-24T00:00:00.000Z',
        priority: 'high',
        requiresImmediateTick: true,
        threadId: null,
        entityRefs: [],
        payload: {},
        dedupeKey: null,
        coalescedCount: 1,
      },
    ],
  };

  const built = buildDecisionContext({
    tickId: 'tick-contract',
    decisionMode: DECISION_MODE.REACTIVE,
    selectedModelProfileId: 'reflex.fast@baseline',
    selectedRole: 'reflex',
    subjectStateSnapshot,
    recentEpisodes: [
      {
        episodeId: 'episode-1',
        tickId: 'tick-1',
        summary: 'earlier episode',
        resultJson: {},
        createdAt: '2026-03-24T00:00:00.000Z',
      },
    ],
    perceptionBatch: partialPerceptionBatch,
    limits: {
      goalLimit: 1,
      beliefLimit: 1,
      entityLimit: 1,
      relationshipLimit: 1,
      recentEpisodeLimit: 1,
    },
  });

  assert.equal(built.accepted, true);
  if (!built.accepted) {
    return;
  }

  assert.equal(built.context.subjectStateMeta.truncated, true);
  assert.deepEqual(built.context.subjectStateMeta.conflictMarkers, ['subject_state_truncated']);
  assert.equal(built.context.subjectStateMeta.sourceIds[0], 'agent:polyphony-core');
  assert.equal(built.context.episodeMeta.truncated, true);
  assert.deepEqual(built.context.episodeMeta.conflictMarkers, ['episode_slice_truncated']);
  assert.equal(built.context.perceptualMeta.truncated, true);
  assert.deepEqual(built.context.perceptualMeta.conflictMarkers, ['perception_partial_claim']);
  assert.equal(built.context.subjectState.subjectStateSchemaVersion, '2026-03-24');

  const incompatible = buildDecisionContext({
    tickId: 'tick-contract',
    decisionMode: DECISION_MODE.REACTIVE,
    selectedModelProfileId: 'reflex.fast@baseline',
    selectedRole: 'reflex',
    subjectStateSnapshot,
    recentEpisodes: [],
    requiredSubjectStateSchemaVersion: '2026-03-25',
  });

  assert.equal(incompatible.accepted, false);
  if (incompatible.accepted) {
    return;
  }

  assert.equal(incompatible.refusal.reason, 'context_incompatible');
});
