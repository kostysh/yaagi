import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND, TICK_STATUS, TICK_TRIGGER } from '@yaagi/contracts/runtime';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';
import { createPhase0TickExecution } from '../../src/runtime/index.ts';

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
      pressure: 0.3,
    },
  },
  goals: [],
  beliefs: [],
  entities: [],
  relationships: [],
};

void test('AC-F0010-04 keeps the executive seam reactive-first and single-outcome for the owning tick', async () => {
  const executiveCalls: string[] = [];
  const executeTick = createPhase0TickExecution({
    selectProfile: (input) =>
      Promise.resolve({
        accepted: true as const,
        modelProfileId: 'reflex.fast@baseline',
        role: 'reflex',
        endpoint: 'http://vllm-fast:8000/v1',
        adapterOf: null,
        selectionReason: {
          tickMode: input.tickMode,
          taskKind: input.taskKind,
          latencyBudget: input.latencyBudget,
          riskLevel: input.riskLevel,
          contextSize: input.contextSize,
          requiredCapabilities: input.requiredCapabilities ?? [],
          lastEvalScore: input.lastEvalScore ?? null,
          health: {
            healthy: true,
            detail: 'stubbed profile is healthy',
          },
        },
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
    runDecision: () =>
      Promise.resolve({
        accepted: true as const,
        decision: {
          observations: ['reactive input received'],
          interpretations: ['handoff should stay executive-owned'],
          action: {
            type: 'reflect',
            summary: 'ask for bounded review',
          },
          episode: {
            summary: 'reactive executive handoff completed',
            importance: 0.5,
          },
          developmentHints: ['do not widen admission'],
        },
      }),
    handleDecisionAction: ({ tickId, action }) => {
      executiveCalls.push(`${tickId}:${action.type}`);
      return Promise.resolve({
        accepted: true as const,
        actionId: `action-${tickId}`,
        verdictKind: 'review_request',
        boundaryCheck: {
          allowed: true,
          reason: 'executive stub accepted the review handoff',
        },
        resultJson: {
          summary: action.summary,
        },
      });
    },
  });

  const harness = createTickRuntimeHarness({
    executeTick,
    now: (() => {
      let step = 0;
      return () => `2026-03-24T00:00:0${step++}Z`;
    })(),
  });

  await harness.runtime.start();

  const reactive = await harness.runtime.requestTick({
    requestId: 'reactive-action',
    kind: TICK_KIND.REACTIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-24T00:00:01Z',
    payload: {
      taskKind: 'reactive.signal',
      contextSize: 32,
      latencyBudget: 'tight',
      riskLevel: 'low',
    },
  });

  assert.equal(reactive.accepted, true);
  if (!reactive.accepted) {
    assert.fail('reactive runtime admission should succeed');
  }

  const reactiveTick = harness.ticks.get(reactive.tickId);
  assert.ok(reactiveTick);
  assert.equal(reactiveTick.status, TICK_STATUS.COMPLETED);
  assert.equal(reactiveTick.actionId, `action-${reactive.tickId}`);
  assert.deepEqual(executiveCalls, [`${reactive.tickId}:reflect`]);

  const deliberativeAdmission = await harness.runtime.requestTick({
    requestId: 'deliberative-still-blocked',
    kind: TICK_KIND.DELIBERATIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-24T00:00:02Z',
    payload: {},
  });

  assert.deepEqual(deliberativeAdmission, {
    accepted: false,
    reason: 'unsupported_tick_kind',
  });
});

void test('AC-F0010-04 preserves ticks.action_id when reactive executive audit append fails after reservation', async () => {
  const executeTick = createPhase0TickExecution({
    selectProfile: () =>
      Promise.resolve({
        accepted: true as const,
        modelProfileId: 'reflex.fast@baseline',
        role: 'reflex',
        endpoint: 'http://vllm-fast:8000/v1',
        adapterOf: null,
        selectionReason: {
          tickMode: 'reactive',
          taskKind: 'reactive.signal',
          latencyBudget: 'tight',
          riskLevel: 'low',
          contextSize: 32,
          requiredCapabilities: [],
          lastEvalScore: null,
          health: {
            healthy: true,
            detail: 'stubbed profile is healthy',
          },
        },
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
    runDecision: () =>
      Promise.resolve({
        accepted: true as const,
        decision: {
          observations: ['reactive input received'],
          interpretations: ['audit append must stay continuity-safe'],
          action: {
            type: 'reflect',
            summary: 'ask for bounded review',
          },
          episode: {
            summary: 'reactive executive handoff completed',
            importance: 0.5,
          },
          developmentHints: ['preserve reserved action id on failure'],
        },
      }),
    handleDecisionAction: ({ tickId }) =>
      Promise.reject(
        Object.assign(new Error('action_log unavailable'), {
          status: TICK_STATUS.FAILED,
          summary: 'executive audit append failed',
          failureDetail: 'action_log unavailable',
          actionId: `action-${tickId}`,
        }),
      ),
  });

  const harness = createTickRuntimeHarness({
    executeTick,
    now: (() => {
      let step = 0;
      return () => `2026-03-24T00:01:0${step++}Z`;
    })(),
  });

  await harness.runtime.start();

  const reactive = await harness.runtime.requestTick({
    requestId: 'reactive-action-audit-failure',
    kind: TICK_KIND.REACTIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-24T00:01:01Z',
    payload: {
      taskKind: 'reactive.signal',
      contextSize: 32,
      latencyBudget: 'tight',
      riskLevel: 'low',
    },
  });

  assert.equal(reactive.accepted, true);
  if (!reactive.accepted) {
    assert.fail('reactive runtime admission should succeed');
  }

  const reactiveTick = harness.ticks.get(reactive.tickId);
  assert.ok(reactiveTick);
  assert.equal(reactiveTick.status, TICK_STATUS.FAILED);
  assert.equal(reactiveTick.actionId, `action-${reactive.tickId}`);
});
