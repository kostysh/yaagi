import test from 'node:test';
import assert from 'node:assert/strict';
import type { NarrativeMemeticTickDelta } from '@yaagi/contracts/cognition';
import { createNarrativeMemeticStore, createTickRuntimeStore } from '../src/index.ts';
import { createSubjectStateDbHarness } from '../testing/subject-state-db-harness.ts';

const createStartedTick = (tickId: string) => ({
  tickId,
  agentId: 'polyphony-core',
  requestId: `request:${tickId}`,
  tickKind: tickId.includes('wake') ? ('wake' as const) : ('reactive' as const),
  triggerKind: 'system' as const,
  status: 'started' as const,
  queuedAt: '2026-03-25T00:00:00.000Z',
  startedAt: '2026-03-25T00:00:00.000Z',
  endedAt: null,
  leaseOwner: 'core',
  leaseExpiresAt: '2026-03-25T00:01:00.000Z',
  requestJson: {},
  resultJson: {},
  failureJson: {},
  continuityFlagsJson: {},
  selectedCoalitionId: null,
  selectedModelProfileId: 'reflex.fast@baseline',
  actionId: null,
  createdAt: '2026-03-25T00:00:00.000Z',
  updatedAt: '2026-03-25T00:00:00.000Z',
});

void test('AC-F0011-01 persists bootstrap baseline surfaces on the canonical completed-tick path', async () => {
  // Covers: AC-F0011-04
  const tickId = 'tick-wake-bootstrap';
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-25',
        bootStateJson: {},
        currentTickId: tickId,
        currentModelProfileId: null,
        lastStableSnapshotId: null,
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
      ticks: {
        [tickId]: createStartedTick(tickId),
      },
    },
  });
  const tickStore = createTickRuntimeStore(harness.db);
  const narrativeStore = createNarrativeMemeticStore(harness.db);
  const delta: NarrativeMemeticTickDelta = {
    seedMemeticUnits: [
      {
        unitId: 'seed:constitution:continuity',
        originKind: 'seeded',
        unitType: 'constitution',
        abstractLabel: 'protect continuity and constitutional guardrails',
        canonicalSummary: 'bootstrap continuity anchor',
        activation: 0.82,
        reinforcement: 0.74,
        decay: 0.08,
        evidenceScore: 0.8,
        status: 'active',
        createdByPath: 'bootstrap.wake',
        provenanceAnchors: ['constitution:continuity'],
      },
      {
        unitId: 'seed:identity:polyphony-core',
        originKind: 'seeded',
        unitType: 'identity',
        abstractLabel: 'polyphony-core identity core',
        canonicalSummary: 'bootstrap identity anchor',
        activation: 0.7,
        reinforcement: 0.68,
        decay: 0.1,
        evidenceScore: 0.72,
        status: 'active',
        createdByPath: 'bootstrap.wake',
        provenanceAnchors: ['agent:polyphony-core'],
      },
    ],
    memeticUnitUpdates: [],
    memeticEdgeUpserts: [],
    coalition: null,
    narrativeVersion: {
      versionId: 'narrative:tick-wake-bootstrap',
      basedOnVersionId: null,
      currentChapter: 'bootstrap',
      summary: 'baseline narrative bootstrap completed',
      continuityDirection: 'bootstrap',
      tensions: [],
      provenanceAnchors: ['constitution:continuity'],
    },
    fieldJournalEntries: [
      {
        entryId: 'journal:tick-wake-bootstrap:main',
        entryType: 'bootstrap',
        summary: 'tracking bootstrap baseline',
        interpretation: 'baseline seeded before the first reactive cognition tick',
        tensionMarkers: ['bootstrap_seeded'],
        maturityState: 'tracking',
        linkedUnitId: 'seed:constitution:continuity',
        provenanceAnchors: ['constitution:continuity'],
      },
    ],
  };

  await tickStore.completeTick({
    tickId,
    occurredAt: new Date('2026-03-25T00:00:05.000Z'),
    summary: 'wake bootstrap completed',
    resultJson: {
      kind: 'wake',
    },
    continuityFlagsJson: {
      narrativeMemeticBootstrapSeeded: true,
    },
    narrativeMemeticDelta: delta,
    subjectStateDelta: {},
  });

  const snapshot = await narrativeStore.loadSnapshot();

  assert.ok(snapshot.activeUnits.length >= 2);
  assert.equal(
    snapshot.activeUnits.some((unit) =>
      unit.provenanceAnchorsJson.includes('constitution:continuity'),
    ),
    true,
  );
  assert.equal(snapshot.latestNarrativeVersion?.versionId, 'narrative:tick-wake-bootstrap');
  assert.equal(
    snapshot.latestNarrativeVersion?.provenanceAnchorsJson.includes('constitution:continuity'),
    true,
  );
  assert.equal(snapshot.recentFieldJournalEntries[0]?.entryId, 'journal:tick-wake-bootstrap:main');
});

void test('AC-F0011-03 updates only existing durable units and persists the winning coalition without creating a new durable unit', async () => {
  // Covers: AC-F0011-04, AC-F0011-06
  const tickId = 'tick-reactive-coalition';
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-25',
        bootStateJson: {},
        currentTickId: tickId,
        currentModelProfileId: 'reflex.fast@baseline',
        lastStableSnapshotId: null,
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
      ticks: {
        [tickId]: createStartedTick(tickId),
      },
      memeticUnits: {
        'seed:goal:goal-operator-reply': {
          unitId: 'seed:goal:goal-operator-reply',
          originKind: 'seeded',
          unitType: 'goal',
          abstractLabel: 'Reply to the operator',
          canonicalSummary: 'bootstrap goal anchor',
          activationScore: 0.61,
          reinforcementScore: 0.55,
          decayScore: 0.12,
          evidenceScore: 0.58,
          status: 'active',
          lastActivatedTickId: 'tick-prev',
          createdByPath: 'bootstrap.wake',
          provenanceAnchorsJson: ['goal:goal-operator-reply'],
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
      },
    },
  });
  const tickStore = createTickRuntimeStore(harness.db);
  const narrativeStore = createNarrativeMemeticStore(harness.db);
  const delta: NarrativeMemeticTickDelta = {
    seedMemeticUnits: [],
    memeticUnitUpdates: [
      {
        unitId: 'seed:goal:goal-operator-reply',
        activation: 0.91,
        reinforcement: 0.84,
        decay: 0.04,
        evidenceScore: 0.88,
        status: 'active',
        lastActivatedTickId: tickId,
        provenanceAnchors: ['goal:goal-operator-reply', 'episode:episode-reactive'],
      },
    ],
    memeticEdgeUpserts: [],
    coalition: {
      coalitionId: 'coalition:tick-reactive-coalition',
      decisionMode: 'reactive',
      vector: 'act',
      memberUnitIds: ['seed:goal:goal-operator-reply'],
      supportScore: 0.91,
      suppressionScore: 0,
      winning: true,
      provenanceAnchors: ['goal:goal-operator-reply'],
    },
    narrativeVersion: {
      versionId: 'narrative:tick-reactive-coalition',
      basedOnVersionId: null,
      currentChapter: 'act',
      summary: 'goal-driven coalition won',
      continuityDirection: 'pivot',
      tensions: [],
      provenanceAnchors: ['goal:goal-operator-reply'],
    },
    fieldJournalEntries: [
      {
        entryId: 'journal:tick-reactive-coalition:main',
        entryType: 'tick_tension',
        summary: 'tracking coalition stability',
        interpretation: 'the coalition remained stable enough for downstream reasoning',
        tensionMarkers: [],
        maturityState: 'immature',
        linkedUnitId: 'seed:goal:goal-operator-reply',
        provenanceAnchors: ['goal:goal-operator-reply'],
      },
    ],
  };

  await tickStore.completeTick({
    tickId,
    occurredAt: new Date('2026-03-25T00:00:05.000Z'),
    summary: 'reactive coalition completed',
    resultJson: {
      kind: 'reactive',
    },
    actionId: 'action-reactive-coalition',
    selectedCoalitionId: 'coalition:tick-reactive-coalition',
    continuityFlagsJson: {
      selectedCoalitionId: 'coalition:tick-reactive-coalition',
    },
    narrativeMemeticDelta: delta,
    subjectStateDelta: {},
  });

  const snapshot = await narrativeStore.loadSnapshot();

  assert.equal(snapshot.activeUnits.length, 1);
  assert.equal(snapshot.activeUnits[0]?.activationScore, 0.91);
  assert.equal(
    snapshot.activeUnits[0]?.provenanceAnchorsJson.includes('goal:goal-operator-reply'),
    true,
  );
  assert.equal(
    snapshot.latestNarrativeVersion?.provenanceAnchorsJson.includes('goal:goal-operator-reply'),
    true,
  );
  assert.equal(
    harness.state.ticks[tickId]?.selectedCoalitionId,
    'coalition:tick-reactive-coalition',
  );
  assert.equal(harness.state.coalitionsById['coalition:tick-reactive-coalition']?.vector, 'act');
});
