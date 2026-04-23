import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStimulusEnvelope,
  STIMULUS_PRIORITY,
  STIMULUS_STATUS,
} from '@yaagi/contracts/perception';
import { TICK_KIND, TICK_STATUS, TICK_TRIGGER } from '@yaagi/contracts/runtime';
import {
  createPerceptionStore,
  createRuntimeModelProfileStore,
  createTickRuntimeStore,
  type RuntimeTickStore,
} from '@yaagi/db';
import { createDecisionHarness } from '../../src/cognition/index.ts';
import { createPerceptionController } from '../../src/perception/index.ts';
import type { CoreRuntimeConfig } from '../../src/platform/core-config.ts';
import {
  createPhase0ModelRouter,
  createPhase0TickExecution,
  createTickRuntime,
  PHASE0_BASELINE_PROFILE_ID,
  type FinishTickInput,
  type StartTickResult,
  type StartedTick,
  type TickRuntimeStore,
} from '../../src/runtime/index.ts';
import { buildPhase0SubjectStateDelta } from '../../src/runtime/runtime-lifecycle.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

const perceptionConfig: CoreRuntimeConfig = {
  postgresUrl: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
  fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
  fastModelDescriptorPath: '/tmp/yaagi-f0009-refusal/models/base/vllm-fast-manifest.json',
  deepModelBaseUrl: 'http://127.0.0.1:8001/v1',
  poolModelBaseUrl: 'http://127.0.0.1:8002/v1',
  telegramEnabled: false,
  telegramBotToken: null,
  telegramAllowedChatIds: [],
  telegramApiBaseUrl: 'https://api.telegram.org',
  seedRootPath: '/tmp/yaagi-f0009-refusal',
  seedConstitutionPath: '/tmp/yaagi-f0009-refusal/constitution.yaml',
  seedBodyPath: '/tmp/yaagi-f0009-refusal/body',
  seedSkillsPath: '/tmp/yaagi-f0009-refusal/skills',
  seedModelsPath: '/tmp/yaagi-f0009-refusal/models',
  seedDataPath: '/tmp/yaagi-f0009-refusal/data',
  workspaceBodyPath: '/tmp/yaagi-f0009-refusal/workspace/body',
  workspaceSkillsPath: '/tmp/yaagi-f0009-refusal/workspace/skills',
  modelsPath: '/tmp/yaagi-f0009-refusal/runtime-models',
  dataPath: '/tmp/yaagi-f0009-refusal/runtime-data',
  migrationsDir: '/tmp/yaagi-f0009-refusal/migrations',
  pgBossSchema: 'pgboss',
  operatorAuthPrincipalsFilePath: null,
  operatorAuthRateLimitWindowMs: 60_000,
  operatorAuthRateLimitMaxRequests: 120,
  host: '127.0.0.1',
  port: 8787,
  bootTimeoutMs: 60_000,
};

const createRuntimeStoreAdapter = (store: RuntimeTickStore): TickRuntimeStore => ({
  initialize: async (): Promise<void> => {
    await store.ensureAgentStateRow();
  },
  startTick: (input: StartedTick): Promise<StartTickResult> => {
    void input;
    throw new Error('createRuntimeStoreAdapter.startTick must be specialized per test');
  },
  finishTick: async (input: FinishTickInput): Promise<void> => {
    if (input.terminal.status === TICK_STATUS.COMPLETED) {
      await store.completeTick({
        tickId: input.tickId,
        occurredAt: new Date(input.finishedAt),
        ...(input.terminal.summary ? { summary: input.terminal.summary } : {}),
        ...(input.terminal.result ? { resultJson: input.terminal.result } : {}),
        ...(input.terminal.continuityFlags
          ? { continuityFlagsJson: input.terminal.continuityFlags }
          : {}),
        ...(input.terminal.actionId ? { actionId: input.terminal.actionId } : {}),
        subjectStateDelta: buildPhase0SubjectStateDelta(input),
      });
      return;
    }

    if (input.terminal.status === TICK_STATUS.CANCELLED) {
      await store.cancelTick({
        tickId: input.tickId,
        occurredAt: new Date(input.finishedAt),
        ...(input.terminal.summary ? { summary: input.terminal.summary } : {}),
        ...(input.terminal.result ? { resultJson: input.terminal.result } : {}),
        ...(input.terminal.failureDetail
          ? { failureJson: { detail: input.terminal.failureDetail } }
          : {}),
        ...(input.terminal.continuityFlags
          ? { continuityFlagsJson: input.terminal.continuityFlags }
          : {}),
        ...(input.terminal.actionId ? { actionId: input.terminal.actionId } : {}),
      });
      return;
    }

    await store.failTick({
      tickId: input.tickId,
      occurredAt: new Date(input.finishedAt),
      ...(input.terminal.summary ? { summary: input.terminal.summary } : {}),
      ...(input.terminal.result ? { resultJson: input.terminal.result } : {}),
      ...(input.terminal.failureDetail
        ? { failureJson: { detail: input.terminal.failureDetail } }
        : {}),
      ...(input.terminal.continuityFlags
        ? { continuityFlagsJson: input.terminal.continuityFlags }
        : {}),
      ...(input.terminal.actionId ? { actionId: input.terminal.actionId } : {}),
    });
  },
  reclaimStaleTicks: async (now: string): Promise<number> =>
    await store.reclaimStaleTicks({
      now: new Date(now),
    }),
});

void test('AC-F0009-05 rejects a reactive runtime handoff when the selected profile drifts ineligible, without durable side effects or silent rerouting', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-24',
        bootStateJson: {},
        currentTickId: null,
        currentModelProfileId: null,
        lastStableSnapshotId: null,
        psmJson: {
          continuityMarker: 'stable',
        },
        resourcePostureJson: {
          pressure: 0.2,
        },
        developmentFreeze: false,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    },
  });
  const tickStore = createTickRuntimeStore(harness.db);
  const modelStore = createRuntimeModelProfileStore(harness.db);
  const perceptionStore = createPerceptionStore(harness.db);
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store: modelStore,
  });
  await router.ensureBaselineProfiles();

  await perceptionStore.enqueueStimulus({
    envelope: buildStimulusEnvelope({
      id: 'stimulus-1',
      source: 'system',
      occurredAt: '2026-03-24T00:00:00.000Z',
      priority: STIMULUS_PRIORITY.CRITICAL,
      requiresImmediateTick: true,
    }),
    signalType: 'system.notice',
    dedupeKey: 'stimulus:operator',
  });

  const perceptionController = createPerceptionController({
    config: perceptionConfig,
    store: perceptionStore,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: false,
        reason: 'boot_inactive',
      }),
  });

  let agentInvocationCount = 0;
  let selectionCalls = 0;
  const decisionHarness = createDecisionHarness({
    invokeAgent: () => {
      agentInvocationCount += 1;
      return Promise.resolve({
        observations: ['should never be emitted'],
        interpretations: ['the decision agent should not run'],
        action: {
          type: 'none',
          summary: 'blocked before agent call',
        },
        episode: {
          summary: 'blocked before agent call',
          importance: 0.1,
        },
        developmentHints: [],
      });
    },
  });
  const runtimeStore = createRuntimeStoreAdapter(tickStore);

  const runtime = createTickRuntime({
    store: {
      ...runtimeStore,
      startTick: (input): Promise<StartTickResult> => {
        if (!harness.state.agentState) {
          throw new Error('agent_state row is required for the runtime test harness');
        }

        if (harness.state.agentState.currentTickId) {
          return Promise.resolve({
            accepted: false,
            reason: 'lease_busy',
          });
        }

        const requestedAt = input.requestedAt;
        const leaseExpiresAt = new Date(new Date(requestedAt).getTime() + 60_000).toISOString();
        harness.state.ticks[input.tickId] = {
          tickId: input.tickId,
          agentId: harness.state.agentState.agentId,
          requestId: input.requestId,
          tickKind: input.kind,
          triggerKind: input.trigger,
          status: TICK_STATUS.STARTED,
          queuedAt: requestedAt,
          startedAt: requestedAt,
          endedAt: null,
          leaseOwner: 'core',
          leaseExpiresAt,
          requestJson: structuredClone(input.payload),
          resultJson: {},
          failureJson: {},
          continuityFlagsJson: {},
          selectedCoalitionId: null,
          selectedModelProfileId: null,
          actionId: null,
          createdAt: requestedAt,
          updatedAt: requestedAt,
        };
        harness.state.agentState.currentTickId = input.tickId;
        harness.state.agentState.updatedAt = requestedAt;

        return Promise.resolve({
          accepted: true,
          tickId: input.tickId,
        });
      },
      reclaimStaleTicks: (): Promise<number> => Promise.resolve(0),
    },
    executeTick: createPhase0TickExecution({
      selectProfile: async (input) => {
        selectionCalls += 1;
        return await router.selectProfile(input);
      },
      persistTickModelSelection: async (input) => {
        await modelStore.persistTickModelSelection(input);
      },
      prepareReactiveTick: async (tickId) => await perceptionController.prepareReactiveTick(tickId),
      loadSubjectStateSnapshot: async (input) => await tickStore.loadSubjectStateSnapshot(input),
      listRecentEpisodes: async (input) => await tickStore.listRecentEpisodes(input),
      runDecision: async (input) => await decisionHarness.run(input),
      handleDecisionAction: () => {
        throw new Error('executive boundary must not run when profile eligibility already failed');
      },
      resolveSelectedProfileEligibility: (): Promise<'profile_unhealthy'> =>
        Promise.resolve('profile_unhealthy'),
    }),
    startupWakeRequestId: 'startup-wake',
  });

  await runtime.start();

  const baselineEpisodeCount = Object.keys(harness.state.episodesById).length;
  const baselinePsmJson = structuredClone(harness.state.agentState?.psmJson ?? {});

  const admission = await runtime.requestTick({
    requestId: 'reactive-refusal',
    kind: TICK_KIND.REACTIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-24T00:00:01.000Z',
    payload: {
      taskKind: 'reactive.signal',
      requiredCapabilities: ['reactive'],
      contextSize: 64,
      latencyBudget: 'tight',
      riskLevel: 'low',
    },
  });

  assert.equal(admission.accepted, true);
  if (!admission.accepted) {
    return;
  }

  const reactiveTick = harness.state.ticks[admission.tickId];
  assert.ok(reactiveTick);
  assert.equal(reactiveTick.status, TICK_STATUS.FAILED);
  assert.equal(reactiveTick.selectedModelProfileId, PHASE0_BASELINE_PROFILE_ID.REFLEX);
  assert.equal(
    reactiveTick.continuityFlagsJson['selectedModelProfileId'],
    PHASE0_BASELINE_PROFILE_ID.REFLEX,
  );
  assert.deepEqual(reactiveTick.continuityFlagsJson['decisionRejected'], {
    reason: 'selected_profile_ineligible',
    detail: `selected profile ${PHASE0_BASELINE_PROFILE_ID.REFLEX} is profile_unhealthy`,
  });
  assert.equal(
    reactiveTick.failureJson['detail'],
    'decision harness rejected: selected_profile_ineligible',
  );
  assert.equal(selectionCalls, 1);
  assert.equal(agentInvocationCount, 0);
  assert.equal(Object.keys(harness.state.episodesById).length, baselineEpisodeCount);
  assert.deepEqual(harness.state.agentState?.psmJson, baselinePsmJson);
  assert.equal(harness.state.agentState?.currentModelProfileId, null);
  assert.equal(harness.state.stimuli['stimulus-1']?.status, STIMULUS_STATUS.QUEUED);
  assert.equal(harness.state.stimuli['stimulus-1']?.claimTickId, null);
});
