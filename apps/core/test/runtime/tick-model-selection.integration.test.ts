import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeModelProfileStore, createTickRuntimeStore, TICK_STATUS } from '@yaagi/db';
import {
  createPhase0ModelRouter,
  createPhase0TickExecution,
  PHASE0_BASELINE_PROFILE_ID,
} from '../../src/runtime/index.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

const startedReactiveTick = {
  tickId: 'tick-reactive-model',
  agentId: 'polyphony-core',
  requestId: 'request-reactive-model',
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
  selectedModelProfileId: null,
  actionId: null,
  createdAt: '2026-03-24T00:00:00.000Z',
  updatedAt: '2026-03-24T00:00:00.000Z',
};

void test('AC-F0008-04 persists selected_model_profile_id and current_model_profile_id for the active tick', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-24',
        bootStateJson: {},
        currentTickId: startedReactiveTick.tickId,
        currentModelProfileId: null,
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
  const modelStore = createRuntimeModelProfileStore(harness.db);
  const tickStore = createTickRuntimeStore(harness.db);
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store: modelStore,
  });
  const executeTick = createPhase0TickExecution({
    selectProfile: (input) => router.selectProfile(input),
    persistTickModelSelection: async (input) => {
      await modelStore.persistTickModelSelection(input);
    },
    prepareReactiveTick: () =>
      Promise.resolve({
        claimedStimulusIds: ['stimulus-1'],
        highestPriority: 'high',
        items: [{ primaryStimulusId: 'stimulus-1', source: 'system' }],
        sourceKinds: ['system'],
      }),
  });

  await router.ensureBaselineProfiles();
  const terminal = await executeTick({
    tickId: startedReactiveTick.tickId,
    kind: 'reactive',
    trigger: 'system',
    requestId: startedReactiveTick.requestId,
    requestedAt: startedReactiveTick.startedAt,
    payload: {
      taskKind: 'reactive.signal',
      requiredCapabilities: ['reactive'],
      contextSize: 128,
      latencyBudget: 'tight',
      riskLevel: 'low',
    },
  });

  assert.equal(terminal.status, TICK_STATUS.COMPLETED);
  assert.equal(
    harness.state.ticks[startedReactiveTick.tickId]?.selectedModelProfileId,
    PHASE0_BASELINE_PROFILE_ID.REFLEX,
  );
  assert.equal(harness.state.agentState?.currentModelProfileId, PHASE0_BASELINE_PROFILE_ID.REFLEX);

  await tickStore.completeTick({
    tickId: startedReactiveTick.tickId,
    occurredAt: new Date('2026-03-24T00:00:05.000Z'),
    summary: 'reactive tick completed',
    resultJson: terminal.result ?? {},
    ...(terminal.continuityFlags ? { continuityFlagsJson: terminal.continuityFlags } : {}),
    subjectStateDelta: {},
  });

  assert.equal(harness.state.agentState?.currentModelProfileId, null);
  assert.equal(
    harness.state.ticks[startedReactiveTick.tickId]?.selectedModelProfileId,
    PHASE0_BASELINE_PROFILE_ID.REFLEX,
  );

  const reclaimHarness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-24',
        bootStateJson: {},
        currentTickId: 'tick-stale-selection',
        currentModelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
        lastStableSnapshotId: null,
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
      ticks: {
        'tick-stale-selection': {
          ...startedReactiveTick,
          tickId: 'tick-stale-selection',
          requestId: 'request-stale-selection',
          leaseExpiresAt: '2026-03-24T00:00:30.000Z',
          selectedModelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
        },
      },
    },
  });
  const reclaimStore = createTickRuntimeStore(reclaimHarness.db);

  await reclaimStore.reclaimStaleTicks({
    now: new Date('2026-03-24T00:02:00.000Z'),
  });

  assert.equal(
    reclaimHarness.state.ticks['tick-stale-selection']?.selectedModelProfileId,
    PHASE0_BASELINE_PROFILE_ID.REFLEX,
  );
  assert.equal(reclaimHarness.state.agentState?.currentModelProfileId, null);
});
