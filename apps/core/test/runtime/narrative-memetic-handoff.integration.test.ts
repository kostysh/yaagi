import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND, TICK_STATUS, TICK_TRIGGER } from '@yaagi/contracts/runtime';
import { createEmptyNarrativeMemeticOutputs } from '@yaagi/contracts/cognition';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';
import { createPhase0TickExecution } from '../../src/runtime/index.ts';

const subjectStateSnapshot = {
  subjectStateSchemaVersion: '2026-03-25',
  agentState: {
    agentId: 'polyphony-core',
    mode: 'normal' as const,
    currentTickId: null,
    currentModelProfileId: null,
    lastStableSnapshotId: null,
    psmJson: {},
    resourcePostureJson: {
      pressure: 0.35,
    },
  },
  goals: [],
  beliefs: [],
  entities: [],
  relationships: [],
};

const createNarrativeOutputs = () => ({
  ...createEmptyNarrativeMemeticOutputs(),
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
    coalitionId: 'coalition:reactive-1',
    vector: 'act',
    strength: 0.91,
    memberUnitIds: ['seed:goal:goal-operator-reply'],
  },
  narrativeSummary: {
    currentChapter: 'act',
    summary: 'goal-driven coalition won',
    continuityDirection: 'pivot',
  },
  provenanceAnchors: ['goal:goal-operator-reply'],
});

const createSelectionReason = () => ({
  tickMode: 'reactive' as const,
  taskKind: 'reactive.signal',
  latencyBudget: 'tight' as const,
  riskLevel: 'low' as const,
  contextSize: 64,
  requiredCapabilities: [],
  lastEvalScore: null,
  health: {
    healthy: true,
    detail: 'stubbed profile is healthy',
  },
});

void test('AC-F0011-01 seeds the narrative/memetic baseline during the wake tick before any previous cycle exists', async () => {
  const executeTick = createPhase0TickExecution({
    selectProfile: () =>
      Promise.resolve({
        accepted: true as const,
        modelProfileId: 'reflex.fast@baseline',
        role: 'reflex' as const,
        endpoint: 'http://vllm-fast:8000/v1',
        adapterOf: null,
        selectionReason: createSelectionReason(),
      }),
    persistTickModelSelection: () => Promise.resolve(undefined),
    prepareReactiveTick: () =>
      Promise.resolve({
        tickId: 'unused',
        claimedStimulusIds: [],
        highestPriority: null,
        requiresImmediateTick: false,
        sourceKinds: [],
        items: [],
      }),
    loadSubjectStateSnapshot: () => Promise.resolve(subjectStateSnapshot),
    listRecentEpisodes: () => Promise.resolve([]),
    prepareNarrativeMemeticCycle: () =>
      Promise.resolve({
        outputs: createNarrativeOutputs(),
        meta: {
          truncated: false,
          sourceIds: ['goal:goal-operator-reply'],
          conflictMarkers: ['bootstrap_seeded'],
        },
        candidates: [],
        seededBaseline: true,
        delta: {
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
          ],
          memeticUnitUpdates: [],
          memeticEdgeUpserts: [],
          coalition: null,
          narrativeVersion: {
            versionId: 'narrative:tick-wake-runtime',
            basedOnVersionId: null,
            currentChapter: 'bootstrap',
            summary: 'wake bootstrap completed',
            continuityDirection: 'bootstrap',
            tensions: [],
            provenanceAnchors: ['constitution:continuity'],
          },
          fieldJournalEntries: [],
        },
      }),
    runDecision: () =>
      Promise.resolve({
        accepted: true as const,
        decision: {
          observations: [],
          interpretations: [],
          action: { type: 'none', summary: 'wake does not call the decision harness' },
          episode: { summary: 'wake', importance: 0 },
          developmentHints: [],
        },
      }),
    handleDecisionAction: () =>
      Promise.resolve({
        accepted: true as const,
        actionId: 'action-wake',
        verdictKind: 'conscious_inaction',
        boundaryCheck: {
          allowed: true,
          reason: 'wake tick does not cross the executive boundary',
        },
        resultJson: {},
      }),
  });

  const terminal = await executeTick({
    tickId: 'tick-wake-runtime',
    requestId: 'request-wake-runtime',
    kind: TICK_KIND.WAKE,
    trigger: TICK_TRIGGER.BOOT,
    requestedAt: '2026-03-25T00:00:00.000Z',
    payload: {},
  });

  assert.equal(terminal.status, TICK_STATUS.COMPLETED);
  assert.equal(terminal.continuityFlags?.['narrativeMemeticBootstrapSeeded'], true);
  assert.equal(terminal.narrativeMemeticDelta?.seedMemeticUnits.length, 1);
});

void test('AC-F0011-05 hands the bounded narrative/memetic read model into downstream decision flow and persists the winning coalition id', async () => {
  let capturedCoalitionId: string | null = null;
  const executeTick = createPhase0TickExecution({
    selectProfile: () =>
      Promise.resolve({
        accepted: true as const,
        modelProfileId: 'reflex.fast@baseline',
        role: 'reflex' as const,
        endpoint: 'http://vllm-fast:8000/v1',
        adapterOf: null,
        selectionReason: createSelectionReason(),
      }),
    persistTickModelSelection: () => Promise.resolve(undefined),
    prepareReactiveTick: (tickId) =>
      Promise.resolve({
        tickId,
        claimedStimulusIds: ['stimulus-1'],
        highestPriority: 'critical',
        requiresImmediateTick: true,
        sourceKinds: ['system'],
        items: [],
      }),
    loadSubjectStateSnapshot: () => Promise.resolve(subjectStateSnapshot),
    listRecentEpisodes: () => Promise.resolve([]),
    prepareNarrativeMemeticCycle: () =>
      Promise.resolve({
        outputs: createNarrativeOutputs(),
        meta: {
          truncated: false,
          sourceIds: ['goal:goal-operator-reply'],
          conflictMarkers: [],
        },
        candidates: [
          {
            candidateId: 'candidate:goal:goal-operator-reply',
            abstractLabel: 'Reply to the operator',
            supportingRefs: ['goal:goal-operator-reply'],
            sourceKinds: ['goal'],
            durablePromotionAllowed: false,
          },
        ],
        seededBaseline: false,
        delta: {
          seedMemeticUnits: [],
          memeticUnitUpdates: [],
          memeticEdgeUpserts: [],
          coalition: {
            coalitionId: 'coalition:reactive-1',
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
      }),
    runDecision: (input) => {
      capturedCoalitionId = input.narrativeMemeticOutputs?.winningCoalition?.coalitionId ?? null;
      return Promise.resolve({
        accepted: true as const,
        decision: {
          observations: ['reactive narrative handoff received'],
          interpretations: ['bounded context remained stable'],
          action: {
            type: 'reflect' as const,
            summary: 'stay bounded',
          },
          episode: {
            summary: 'reactive narrative handoff completed',
            importance: 0.5,
          },
          developmentHints: [],
        },
      });
    },
    handleDecisionAction: () =>
      Promise.resolve({
        accepted: true as const,
        actionId: 'action-reactive-narrative',
        verdictKind: 'review_request',
        boundaryCheck: {
          allowed: true,
          reason: 'reactive handoff stayed declarative',
        },
        resultJson: {},
      }),
  });
  const harness = createTickRuntimeHarness({
    executeTick,
    now: (() => {
      let step = 0;
      return () => `2026-03-25T00:00:0${step++}Z`;
    })(),
  });

  await harness.runtime.start();

  const reactive = await harness.runtime.requestTick({
    requestId: 'reactive-narrative',
    kind: TICK_KIND.REACTIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-25T00:00:01Z',
    payload: {
      taskKind: 'reactive.signal',
    },
  });

  assert.equal(reactive.accepted, true);
  if (!reactive.accepted) {
    return;
  }

  assert.equal(capturedCoalitionId, 'coalition:reactive-1');
  assert.equal(harness.ticks.get(reactive.tickId)?.selectedCoalitionId, 'coalition:reactive-1');
});
