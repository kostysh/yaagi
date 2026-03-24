import test from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_MODE } from '@yaagi/contracts/cognition';
import { createDecisionHarness } from '../../src/cognition/index.ts';

const baseInput = {
  tickId: 'tick-selected-profile',
  decisionMode: DECISION_MODE.REACTIVE,
  subjectStateSnapshot: {
    subjectStateSchemaVersion: '2026-03-24',
    agentState: {
      agentId: 'polyphony-core',
      mode: 'normal' as const,
      currentTickId: null,
      currentModelProfileId: 'reflex.fast@baseline',
      lastStableSnapshotId: null,
      psmJson: {},
      resourcePostureJson: {
        pressure: 0.2,
      },
    },
    goals: [],
    beliefs: [],
    entities: [],
    relationships: [],
  },
  recentEpisodes: [],
  perceptionBatch: {
    tickId: 'tick-selected-profile',
    claimedStimulusIds: ['stimulus-1'],
    highestPriority: 'critical' as const,
    requiresImmediateTick: true,
    sourceKinds: ['http' as const],
    items: [
      {
        stimulusIds: ['stimulus-1'],
        primaryStimulusId: 'stimulus-1',
        source: 'http' as const,
        signalType: 'http.operator.message',
        occurredAt: '2026-03-24T00:00:00.000Z',
        priority: 'critical' as const,
        requiresImmediateTick: true,
        threadId: 'operator-http',
        entityRefs: [],
        payload: {},
        dedupeKey: null,
        coalescedCount: 1,
      },
    ],
  },
};

void test('AC-F0009-05 consumes the selected baseline profile without rerouting or expanding admission ownership', async () => {
  let invocationCount = 0;
  const harness = createDecisionHarness({
    invokeAgent: () => {
      invocationCount += 1;
      return Promise.resolve({
        observations: ['selected profile consumed'],
        interpretations: ['reactive path can proceed'],
        action: {
          type: 'none',
          summary: 'no external action is needed',
        },
        episode: {
          summary: 'selected profile was consumed without rerouting',
          importance: 0.3,
        },
        developmentHints: [],
      });
    },
  });

  const missing = await harness.run({
    ...baseInput,
    selectedProfile: null,
  });
  assert.equal(missing.accepted, false);
  if (!missing.accepted) {
    assert.equal(missing.reason, 'selected_profile_missing');
  }
  assert.equal(invocationCount, 0);

  const ineligible = await harness.run({
    ...baseInput,
    selectedProfile: {
      modelProfileId: 'reflex.fast@baseline',
      role: 'reflex' as const,
      endpoint: 'http://vllm-fast:8000/v1',
      adapterOf: null,
      eligibility: 'profile_unhealthy' as const,
    },
  });
  assert.equal(ineligible.accepted, false);
  if (!ineligible.accepted) {
    assert.equal(ineligible.reason, 'selected_profile_ineligible');
  }
  assert.equal(invocationCount, 0);

  const accepted = await harness.run({
    ...baseInput,
    selectedProfile: {
      modelProfileId: 'reflex.fast@baseline',
      role: 'reflex' as const,
      endpoint: 'http://vllm-fast:8000/v1',
      adapterOf: null,
      eligibility: 'eligible' as const,
    },
  });
  assert.equal(accepted.accepted, true);
  assert.equal(invocationCount, 1);
});
