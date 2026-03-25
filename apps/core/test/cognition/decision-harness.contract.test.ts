import test from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_MODE } from '@yaagi/contracts/cognition';
import { createDecisionHarness } from '../../src/cognition/index.ts';

const baseInput = {
  tickId: 'tick-decision',
  decisionMode: DECISION_MODE.REACTIVE,
  selectedProfile: {
    modelProfileId: 'reflex.fast@baseline',
    role: 'reflex' as const,
    endpoint: 'http://vllm-fast:8000/v1',
    adapterOf: null,
    eligibility: 'eligible' as const,
  },
  subjectStateSnapshot: {
    subjectStateSchemaVersion: '2026-03-24',
    agentState: {
      agentId: 'polyphony-core',
      mode: 'normal' as const,
      currentTickId: null,
      currentModelProfileId: null,
      lastStableSnapshotId: null,
      psmJson: {},
      resourcePostureJson: {
        pressure: 0.1,
      },
    },
    goals: [],
    beliefs: [],
    entities: [],
    relationships: [],
  },
  recentEpisodes: [],
  perceptionBatch: {
    tickId: 'tick-decision',
    claimedStimulusIds: ['stimulus-1'],
    highestPriority: 'normal' as const,
    requiresImmediateTick: false,
    sourceKinds: ['system' as const],
    items: [
      {
        stimulusIds: ['stimulus-1'],
        primaryStimulusId: 'stimulus-1',
        source: 'system' as const,
        signalType: 'system.notice',
        occurredAt: '2026-03-24T00:00:00.000Z',
        priority: 'normal' as const,
        requiresImmediateTick: false,
        threadId: null,
        entityRefs: [],
        payload: {},
        dedupeKey: null,
        coalescedCount: 1,
      },
    ],
  },
};

void test('AC-F0009-03 returns a validated TickDecisionV1 envelope from the bounded decision harness contract', async () => {
  const harness = createDecisionHarness({
    invokeAgent: () =>
      Promise.resolve({
        observations: ['stimulus observed'],
        interpretations: ['reactive path is sufficient'],
        action: {
          type: 'reflect',
          summary: 'keep the phase-0 decision bounded',
        },
        episode: {
          summary: 'bounded reactive decision completed',
          importance: 0.5,
        },
        developmentHints: ['stay conservative'],
      }),
  });

  const result = await harness.run(baseInput);
  assert.equal(result.accepted, true);
  if (!result.accepted) {
    return;
  }

  assert.equal(result.decision.action.type, 'reflect');
  assert.equal(result.decision.episode.summary, 'bounded reactive decision completed');
});

void test('AC-F0009-04 refuses invalid decision output before downstream handoff', async () => {
  const harness = createDecisionHarness({
    invokeAgent: () =>
      Promise.resolve({
        action: {
          type: 'reflect',
        },
      }),
  });

  const result = await harness.run(baseInput);
  assert.equal(result.accepted, false);
  if (result.accepted) {
    return;
  }

  assert.equal(result.reason, 'decision_schema_invalid');
});
