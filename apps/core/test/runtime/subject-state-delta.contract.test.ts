import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_STATUS } from '@yaagi/contracts/runtime';
import { createTickRuntimeStore } from '@yaagi/db';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';
import { buildPhase0SubjectStateDelta } from '../../src/runtime/runtime-lifecycle.ts';

const startedReactiveTick = {
  tickId: 'tick-reactive-completed',
  agentId: 'polyphony-core',
  requestId: 'request-reactive-completed',
  tickKind: 'reactive' as const,
  triggerKind: 'system' as const,
  status: TICK_STATUS.STARTED,
  queuedAt: '2026-03-24T00:00:00.000Z',
  startedAt: '2026-03-24T00:00:00.000Z',
  endedAt: null,
  leaseOwner: 'core',
  leaseExpiresAt: '2026-03-24T00:01:00.000Z',
  requestJson: {},
  resultJson: {},
  failureJson: {},
  continuityFlagsJson: {},
  selectedCoalitionId: null,
  selectedModelProfileId: 'reflex.fast@baseline',
  actionId: null,
  createdAt: '2026-03-24T00:00:00.000Z',
  updatedAt: '2026-03-24T00:00:00.000Z',
};

void test('AC-F0009-04 does not mirror structured decision artifacts into subject-state persistence on completed ticks', async () => {
  // Covers: AC-F0011-06
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-24',
        bootStateJson: {},
        currentTickId: startedReactiveTick.tickId,
        currentModelProfileId: 'reflex.fast@baseline',
        lastStableSnapshotId: null,
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
      ticks: {
        [startedReactiveTick.tickId]: startedReactiveTick,
      },
    },
  });
  const tickStore = createTickRuntimeStore(harness.db);
  const terminalResult = {
    kind: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    perceptionBatch: {
      tickId: startedReactiveTick.tickId,
      claimedStimulusIds: ['stimulus-1'],
      highestPriority: 'critical' as const,
      requiresImmediateTick: true,
      sourceKinds: ['system' as const],
      items: [],
    },
    decision: {
      observations: ['operator signal claimed'],
      interpretations: ['bounded decision completed'],
      action: {
        type: 'reflect' as const,
        summary: 'respond conservatively',
      },
      episode: {
        summary: 'bounded reactive decision completed',
        importance: 0.5,
      },
      developmentHints: ['preserve runtime ownership boundaries'],
    },
    decisionTrace: {
      decisionMode: 'reactive',
      subjectStateSchemaVersion: '2026-03-24',
      recentEpisodeIds: [],
      perceptualSourceIds: ['stimulus-1'],
      validation: {
        accepted: true,
        schema: 'TickDecisionV1',
      },
    },
    executive: {
      accepted: true,
      actionId: 'action-reactive-completed',
      verdictKind: 'review_request',
      boundaryCheck: {
        allowed: true,
        reason: 'review was explicitly requested',
      },
      resultJson: {
        outcome: 'review_request',
      },
    },
    narrativeMemetic: {
      activeMemeticUnits: [
        {
          unitId: 'seed:goal:goal-operator-reply',
          label: 'Reply to the operator',
          activation: 0.91,
          reinforcement: 0.84,
          decay: 0.04,
        },
      ],
      winningCoalition: {
        coalitionId: 'coalition-reactive-completed',
        vector: 'act',
        strength: 0.91,
        memberUnitIds: ['seed:goal:goal-operator-reply'],
      },
      coalitionDiagnostics: {
        suppressedUnitIds: [],
        supportEdges: [],
        conflictMarkers: [],
      },
      affectPatch: {},
      narrativeSummary: {
        currentChapter: 'act',
        summary: 'goal-driven coalition won',
        continuityDirection: 'pivot',
      },
      fieldJournalExcerpts: [],
      narrativeTensions: [],
      provenanceAnchors: ['goal:goal-operator-reply'],
    },
  } satisfies Record<string, unknown>;

  await tickStore.completeTick({
    tickId: startedReactiveTick.tickId,
    occurredAt: new Date('2026-03-24T00:00:05.000Z'),
    summary: 'bounded reactive decision completed',
    resultJson: terminalResult,
    actionId: 'action-reactive-completed',
    selectedCoalitionId: 'coalition-reactive-completed',
    continuityFlagsJson: {
      selectedModelProfileId: 'reflex.fast@baseline',
      selectedCoalitionId: 'coalition-reactive-completed',
    },
    narrativeMemeticDelta: {
      seedMemeticUnits: [],
      memeticUnitUpdates: [],
      memeticEdgeUpserts: [],
      coalition: {
        coalitionId: 'coalition-reactive-completed',
        decisionMode: 'reactive',
        vector: 'act',
        memberUnitIds: ['seed:goal:goal-operator-reply'],
        supportScore: 0.91,
        suppressionScore: 0,
        winning: true,
        provenanceAnchors: ['goal:goal-operator-reply'],
      },
      narrativeVersion: null,
      fieldJournalEntries: [],
    },
    subjectStateDelta: buildPhase0SubjectStateDelta({
      tickId: startedReactiveTick.tickId,
      finishedAt: '2026-03-24T00:00:05.000Z',
      terminal: {
        status: TICK_STATUS.COMPLETED,
        summary: 'bounded reactive decision completed',
        result: terminalResult,
        actionId: 'action-reactive-completed',
        selectedCoalitionId: 'coalition-reactive-completed',
        continuityFlags: {
          selectedModelProfileId: 'reflex.fast@baseline',
          selectedCoalitionId: 'coalition-reactive-completed',
        },
      },
    }),
  });

  assert.deepEqual(harness.state.agentState?.psmJson, {
    lastCompletedTickId: startedReactiveTick.tickId,
    lastCompletedSummary: 'bounded reactive decision completed',
  });
  assert.equal(
    Object.hasOwn(harness.state.agentState?.psmJson ?? {}, 'lastCompletedResult'),
    false,
  );
  assert.equal(
    harness.state.ticks[startedReactiveTick.tickId]?.actionId,
    'action-reactive-completed',
  );
  assert.equal(
    harness.state.ticks[startedReactiveTick.tickId]?.selectedCoalitionId,
    'coalition-reactive-completed',
  );
});
