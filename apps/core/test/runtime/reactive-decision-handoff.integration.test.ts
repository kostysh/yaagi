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
      pressure: 0.4,
    },
  },
  goals: [],
  beliefs: [],
  entities: [],
  relationships: [],
};

const buildExecution = () =>
  createPhase0TickExecution({
    selectProfile: (input) =>
      Promise.resolve({
        accepted: true as const,
        modelProfileId:
          input.tickMode === 'reactive'
            ? 'reflex.fast@baseline'
            : input.tickMode === 'deliberative'
              ? 'deliberation.fast@baseline'
              : 'reflection.fast@baseline',
        role:
          input.tickMode === 'reactive'
            ? 'reflex'
            : input.tickMode === 'deliberative'
              ? 'deliberation'
              : 'reflection',
        endpoint: 'http://vllm-fast:8000/v1',
        adapterOf: input.tickMode === 'contemplative' ? 'deliberation.fast@baseline' : null,
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
        items: [
          {
            stimulusIds: ['stimulus-1'],
            primaryStimulusId: 'stimulus-1',
            source: 'system',
            signalType: 'system.notice',
            occurredAt: '2026-03-24T00:00:00.000Z',
            priority: 'critical',
            requiresImmediateTick: true,
            threadId: null,
            entityRefs: [],
            payload: {},
            dedupeKey: null,
            coalescedCount: 1,
          },
        ],
      }),
    loadSubjectStateSnapshot: () => Promise.resolve(subjectStateSnapshot),
    listRecentEpisodes: () => Promise.resolve([]),
    runDecision: (input) =>
      Promise.resolve({
        accepted: true as const,
        decision: {
          observations: [`${input.decisionMode} input received`],
          interpretations: ['bounded harness produced a structured decision'],
          action: {
            type: input.decisionMode === 'reactive' ? 'reflect' : 'none',
            summary: 'keep the decision bounded to phase 0',
          },
          episode: {
            summary: `${input.decisionMode} structured decision completed`,
            importance: 0.45,
          },
          developmentHints: ['do not expand runtime admission implicitly'],
        },
      }),
    handleDecisionAction: ({ action }) =>
      Promise.resolve({
        accepted: true as const,
        actionId: `action-${action.type}`,
        verdictKind: action.type === 'reflect' ? 'review_request' : 'conscious_inaction',
        boundaryCheck: {
          allowed: true,
          reason: 'test executive stub accepted the declarative action',
        },
        resultJson: {
          summary: action.summary,
        },
      }),
  });

void test('AC-F0009-06 keeps the harness reactive-first without silently expanding deliberative or contemplative admission', async () => {
  const executeTick = buildExecution();
  const harness = createTickRuntimeHarness({
    executeTick,
    now: (() => {
      let step = 0;
      return () => `2026-03-24T00:00:0${step++}Z`;
    })(),
  });

  await harness.runtime.start();

  const reactive = await harness.runtime.requestTick({
    requestId: 'reactive-decision',
    kind: TICK_KIND.REACTIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-24T00:00:01Z',
    payload: {
      taskKind: 'reactive.signal',
      contextSize: 64,
      latencyBudget: 'tight',
      riskLevel: 'low',
    },
  });

  assert.equal(reactive.accepted, true);
  if (!reactive.accepted) {
    assert.fail('reactive tick admission should succeed');
  }

  const reactiveTick = harness.ticks.get(reactive.tickId);
  assert.ok(reactiveTick);
  assert.equal(reactiveTick.status, TICK_STATUS.COMPLETED);
  assert.equal(harness.episodes.at(-1)?.summary, 'reactive structured decision completed');

  const deliberativeAdmission = await harness.runtime.requestTick({
    requestId: 'deliberative-blocked',
    kind: TICK_KIND.DELIBERATIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-24T00:00:02Z',
    payload: {},
  });
  assert.deepEqual(deliberativeAdmission, {
    accepted: false,
    reason: 'unsupported_tick_kind',
  });

  const directDeliberative = await executeTick({
    tickId: 'tick-direct-deliberative',
    kind: TICK_KIND.DELIBERATIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestId: 'direct-deliberative',
    requestedAt: '2026-03-24T00:00:03Z',
    payload: {
      taskKind: 'deliberative.review',
      contextSize: 256,
      latencyBudget: 'normal',
      riskLevel: 'medium',
    },
  });
  assert.equal(directDeliberative.status, TICK_STATUS.COMPLETED);

  const directContemplative = await executeTick({
    tickId: 'tick-direct-contemplative',
    kind: TICK_KIND.CONTEMPLATIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestId: 'direct-contemplative',
    requestedAt: '2026-03-24T00:00:04Z',
    payload: {
      taskKind: 'contemplative.review',
      contextSize: 256,
      latencyBudget: 'normal',
      riskLevel: 'low',
    },
  });
  assert.equal(directContemplative.status, TICK_STATUS.COMPLETED);
});
