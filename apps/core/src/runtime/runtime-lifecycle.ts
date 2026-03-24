import path from 'node:path';
import type { Client } from 'pg';
import { DEPENDENCY } from '@yaagi/contracts/boot';
import {
  DEFAULT_PERCEPTION_HEALTH,
  type HttpIngestStimulusInput,
  type PerceptionHealthSnapshot,
} from '@yaagi/contracts/perception';
import {
  appendRuntimeTimelineEvent,
  createPerceptionStore,
  createRuntimeDbClient,
  createRuntimeModelProfileStore,
  createTickRuntimeStore,
  ensureRuntimeAgentStateRow,
  getRuntimeAgentStateRow,
  type SubjectStateDelta,
  type RuntimeMode,
} from '@yaagi/db';
import type { SystemEvent } from '@yaagi/contracts/boot';
import { TICK_STATUS, type TickTerminalResult } from '@yaagi/contracts/runtime';
import { ConstitutionalBootService } from '../boot/index.ts';
import { createPerceptionController, type StimulusIngestResult } from '../perception/index.ts';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import {
  createPhase0ModelRouter,
  type BaselineModelProfileDiagnostic,
  type BaselineRoutingSelection,
  type ModelHealthSummary,
} from './model-router.ts';
import {
  createTickRuntime,
  type FinishTickInput,
  type StartedTick,
  type StartTickResult,
  type TickRuntime,
  type TickRuntimeStore,
} from './tick-runtime.ts';

type RuntimeLifecycle = {
  start(): Promise<void>;
  stop(): Promise<void>;
  requestTick(input: {
    requestId: string;
    kind: StartedTick['kind'];
    trigger: StartedTick['trigger'];
    requestedAt: string;
    payload: Record<string, unknown>;
  }): Promise<{
    accepted: boolean;
    reason?: 'boot_inactive' | 'lease_busy' | 'unsupported_tick_kind';
  }>;
  ingestHttpStimulus(input: HttpIngestStimulusInput): Promise<StimulusIngestResult>;
  health(): Promise<PerceptionHealthSnapshot>;
  getModelRoutingDiagnostics(input?: {
    reflex?: ModelHealthSummary;
    deliberation?: ModelHealthSummary;
    reflection?: ModelHealthSummary;
  }): Promise<BaselineModelProfileDiagnostic[]>;
};

const buildPhase0SubjectStateDelta = (input: FinishTickInput): SubjectStateDelta => {
  if (input.terminal.status !== TICK_STATUS.COMPLETED) {
    return {};
  }

  return {
    agentStatePatch: {
      psmJson: {
        lastCompletedTickId: input.tickId,
        lastCompletedSummary: input.terminal.summary ?? null,
        lastCompletedResult: input.terminal.result ?? {},
      },
    },
  };
};

const readSchemaVersion = async (client: Client): Promise<string> => {
  const result = await client.query<{ schema_version: string }>(
    `select schema_version
     from platform_bootstrap.schema_state
     where id = 1`,
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('platform_bootstrap.schema_state row is missing');
  }

  return row.schema_version;
};

const withRuntimeClient = async <T>(
  connectionString: string,
  run: (client: Client) => Promise<T>,
): Promise<T> => {
  const client = createRuntimeDbClient(connectionString);
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
};

const findRuntimeRoot = (config: CoreRuntimeConfig): string => {
  const targets = [
    config.seedRootPath,
    config.seedConstitutionPath,
    config.workspaceBodyPath,
    config.workspaceSkillsPath,
    config.modelsPath,
    config.dataPath,
  ].map((target) => path.resolve(target));
  const [first, ...rest] = targets;
  if (!first) {
    return process.cwd();
  }

  const firstSegments = first.split(path.sep).filter(Boolean);
  let sharedLength = firstSegments.length;

  for (const target of rest) {
    const segments = target.split(path.sep).filter(Boolean);
    sharedLength = Math.min(sharedLength, segments.length);

    for (let index = 0; index < sharedLength; index += 1) {
      if (segments[index] !== firstSegments[index]) {
        sharedLength = index;
        break;
      }
    }
  }

  if (sharedLength === 0) {
    return path.parse(first).root;
  }

  return path.join(path.parse(first).root, ...firstSegments.slice(0, sharedLength));
};

const createDependencyProbeMap = (config: CoreRuntimeConfig) => ({
  [DEPENDENCY.POSTGRES]: () =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      await client.query('select 1');
      return { ok: true as const };
    }),
  [DEPENDENCY.MODEL_FAST]: async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_500);

    try {
      const response = await fetch(new URL('models', `${config.fastModelBaseUrl}/`), {
        method: 'GET',
        signal: controller.signal,
      });
      return { ok: response.ok, ...(response.ok ? {} : { detail: `${response.status}` }) };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  },
});

const createFastModelHealthProbe =
  (config: CoreRuntimeConfig) => async (): Promise<ModelHealthSummary> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_500);

    try {
      const response = await fetch(new URL('models', `${config.fastModelBaseUrl}/`), {
        method: 'GET',
        signal: controller.signal,
      });

      if (response.ok) {
        return {
          healthy: true,
          detail: 'model-fast dependency is reachable',
        };
      }

      return {
        healthy: false,
        detail: `model-fast probe returned ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  };

const createDbBackedTickRuntimeStore = (
  config: CoreRuntimeConfig,
  options: {
    ensureBaselineProfiles?: () => Promise<void>;
  } = {},
): TickRuntimeStore => ({
  initialize: () =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createTickRuntimeStore(client);
      await ensureRuntimeAgentStateRow(client);
      const snapshot = await store.loadSubjectStateSnapshot();
      const expectedSchemaVersion = await readSchemaVersion(client);
      if (snapshot.subjectStateSchemaVersion !== expectedSchemaVersion) {
        throw new Error(
          `unsupported subject-state schema version ${snapshot.subjectStateSchemaVersion}; expected ${expectedSchemaVersion}`,
        );
      }
      if (options.ensureBaselineProfiles) {
        await options.ensureBaselineProfiles();
      }
    }),

  startTick: (input: StartedTick): Promise<StartTickResult> =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createTickRuntimeStore(client);
      const result = await store.requestTick({
        requestId: input.requestId,
        kind: input.kind,
        trigger: input.trigger,
        requestedAt: new Date(input.requestedAt),
        payload: input.payload,
      });

      if (!result.accepted) {
        return {
          accepted: false,
          reason: result.reason,
        };
      }

      return {
        accepted: true,
        tickId: result.tick.tickId,
        ...(result.deduplicated ? { deduplicated: true } : {}),
      };
    }),

  finishTick: (input: FinishTickInput): Promise<void> =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createTickRuntimeStore(client);
      const finalization = {
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
      };

      if (input.terminal.status === TICK_STATUS.COMPLETED) {
        await store.completeTick({
          ...finalization,
          subjectStateDelta: buildPhase0SubjectStateDelta(input),
        });
        return;
      }

      if (input.terminal.status === TICK_STATUS.CANCELLED) {
        await store.cancelTick(finalization);
        return;
      }

      await store.failTick(finalization);
    }),

  reclaimStaleTicks: (now: string): Promise<number> =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createTickRuntimeStore(client);
      return await store.reclaimStaleTicks({
        now: new Date(now),
      });
    }),
});

const createDbBackedModelProfileStore = (config: CoreRuntimeConfig) => ({
  ensureModelProfiles: (
    profiles: Parameters<
      ReturnType<typeof createRuntimeModelProfileStore>['ensureModelProfiles']
    >[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createRuntimeModelProfileStore(client);
      return await store.ensureModelProfiles(profiles);
    }),

  listModelProfiles: (
    input?: Parameters<ReturnType<typeof createRuntimeModelProfileStore>['listModelProfiles']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createRuntimeModelProfileStore(client);
      return await store.listModelProfiles(input);
    }),

  persistTickModelSelection: (
    input: Parameters<
      ReturnType<typeof createRuntimeModelProfileStore>['persistTickModelSelection']
    >[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createRuntimeModelProfileStore(client);
      return await store.persistTickModelSelection(input);
    }),

  setCurrentModelProfile: (
    modelProfileId: Parameters<
      ReturnType<typeof createRuntimeModelProfileStore>['setCurrentModelProfile']
    >[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createRuntimeModelProfileStore(client);
      await store.setCurrentModelProfile(modelProfileId);
    }),
});

const buildRoutingInputFromTick = (
  context: StartedTick,
): Parameters<ReturnType<typeof createPhase0ModelRouter>['selectProfile']>[0] => {
  const payload = context.payload;
  const tickMode =
    context.kind === 'reactive' ||
    context.kind === 'deliberative' ||
    context.kind === 'contemplative'
      ? context.kind
      : (() => {
          throw new Error(
            `tick kind ${context.kind} cannot be routed through the baseline model router`,
          );
        })();
  const contextSize =
    typeof payload['contextSize'] === 'number' && Number.isFinite(payload['contextSize'])
      ? payload['contextSize']
      : JSON.stringify(payload).length;
  const requiredCapabilities = Array.isArray(payload['requiredCapabilities'])
    ? payload['requiredCapabilities'].filter(
        (capability): capability is string => typeof capability === 'string',
      )
    : [];
  const lastEvalScore =
    typeof payload['lastEvalScore'] === 'number' && Number.isFinite(payload['lastEvalScore'])
      ? payload['lastEvalScore']
      : null;

  return {
    tickMode,
    taskKind:
      typeof payload['taskKind'] === 'string' && payload['taskKind'].length > 0
        ? payload['taskKind']
        : `${context.kind}.default`,
    latencyBudget:
      payload['latencyBudget'] === 'tight' ||
      payload['latencyBudget'] === 'normal' ||
      payload['latencyBudget'] === 'extended'
        ? payload['latencyBudget']
        : context.kind === 'reactive'
          ? 'tight'
          : 'normal',
    riskLevel:
      payload['riskLevel'] === 'low' ||
      payload['riskLevel'] === 'medium' ||
      payload['riskLevel'] === 'high'
        ? payload['riskLevel']
        : 'low',
    contextSize,
    requiredCapabilities,
    lastEvalScore,
    ...(typeof payload['requestedRole'] === 'string'
      ? { requestedRole: payload['requestedRole'] }
      : {}),
  };
};

export const createPhase0TickExecution =
  (dependencies: {
    selectProfile: (
      input: ReturnType<typeof buildRoutingInputFromTick>,
    ) => Promise<BaselineRoutingSelection>;
    persistTickModelSelection: (input: {
      tickId: string;
      modelProfileId: string;
      selectionReasonJson: Record<string, unknown>;
    }) => Promise<void>;
    prepareReactiveTick: (tickId: string) => Promise<{
      claimedStimulusIds: string[];
      highestPriority: string | null;
      items: Array<{
        primaryStimulusId: string;
        source: string;
      }>;
      sourceKinds: string[];
    }>;
  }) =>
  async (context: StartedTick): Promise<TickTerminalResult> => {
    if (context.kind === 'wake') {
      return {
        status: TICK_STATUS.COMPLETED,
        summary: 'Phase-0 wake tick completed',
        result: {
          kind: context.kind,
          trigger: context.trigger,
        },
      };
    }

    const selection = await dependencies.selectProfile(buildRoutingInputFromTick(context));
    if (!selection.accepted) {
      return {
        status: TICK_STATUS.FAILED,
        summary: `${context.kind} tick failed before model selection`,
        failureDetail: `model selection rejected: ${selection.reason}`,
        continuityFlags: {
          modelSelectionRejected: {
            reason: selection.reason,
            detail: selection.detail,
          },
        },
        result: {
          kind: context.kind,
          trigger: context.trigger,
          requestId: context.requestId,
          selectionRejected: {
            reason: selection.reason,
            detail: selection.detail,
          },
        },
      };
    }

    await dependencies.persistTickModelSelection({
      tickId: context.tickId,
      modelProfileId: selection.modelProfileId,
      selectionReasonJson: selection.selectionReason,
    });

    const perceptionBatch =
      context.kind === 'reactive'
        ? await dependencies.prepareReactiveTick(context.tickId)
        : {
            claimedStimulusIds: [],
            highestPriority: null,
            items: [],
            sourceKinds: [],
          };

    return {
      status: TICK_STATUS.COMPLETED,
      summary:
        context.kind === 'reactive'
          ? 'Phase-0 reactive tick completed'
          : 'Phase-0 baseline routed tick completed',
      result: {
        kind: context.kind,
        trigger: context.trigger,
        requestId: context.requestId,
        payload: context.payload,
        selectedModelProfileId: selection.modelProfileId,
        selectedRole: selection.role,
        modelEndpoint: selection.endpoint,
        selectionReason: selection.selectionReason,
        perceptionBatch,
      },
      continuityFlags: {
        selectedModelProfileId: selection.modelProfileId,
      },
    };
  };

const createDbBackedPerceptionStore = (config: CoreRuntimeConfig) => ({
  enqueueStimulus: (
    input: Parameters<ReturnType<typeof createPerceptionStore>['enqueueStimulus']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createPerceptionStore(client);
      return await store.enqueueStimulus(input);
    }),

  findLatestBySourceAndDedupeKey: (
    input: Parameters<
      ReturnType<typeof createPerceptionStore>['findLatestBySourceAndDedupeKey']
    >[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createPerceptionStore(client);
      return await store.findLatestBySourceAndDedupeKey(input);
    }),

  updateQueuedStimulus: (
    input: Parameters<ReturnType<typeof createPerceptionStore>['updateQueuedStimulus']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createPerceptionStore(client);
      return await store.updateQueuedStimulus(input);
    }),

  loadReadyStimuli: (
    input?: Parameters<ReturnType<typeof createPerceptionStore>['loadReadyStimuli']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createPerceptionStore(client);
      return await store.loadReadyStimuli(input);
    }),

  claimStimuli: (input: Parameters<ReturnType<typeof createPerceptionStore>['claimStimuli']>[0]) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createPerceptionStore(client);
      return await store.claimStimuli(input);
    }),

  releaseClaimedStimuli: (
    input: Parameters<ReturnType<typeof createPerceptionStore>['releaseClaimedStimuli']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createPerceptionStore(client);
      return await store.releaseClaimedStimuli(input);
    }),

  countBacklog: () =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createPerceptionStore(client);
      return await store.countBacklog();
    }),

  attachTickPerceptionClaim: (
    input: Parameters<ReturnType<typeof createPerceptionStore>['attachTickPerceptionClaim']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createPerceptionStore(client);
      await store.attachTickPerceptionClaim(input);
    }),
});

const createTimelinePort = (config: CoreRuntimeConfig) => ({
  publish: (event: SystemEvent<Record<string, unknown>>) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      await appendRuntimeTimelineEvent(client, {
        eventType: event.type,
        subjectRef: event.type,
        occurredAt: new Date(event.recordedAt),
        payloadJson: event.payload,
      });
    }),
});

const createAgentStatePort = (config: CoreRuntimeConfig) => ({
  async getLastStableSnapshotId(): Promise<string | null> {
    return await withRuntimeClient(config.postgresUrl, async (client) => {
      const state = await getRuntimeAgentStateRow(client);
      return state?.lastStableSnapshotId ?? null;
    });
  },

  async getSubjectStateSchemaVersion(): Promise<string | null> {
    return await withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createTickRuntimeStore(client);
      const snapshot = await store.loadSubjectStateSnapshot({
        goalLimit: 0,
        beliefLimit: 0,
        entityLimit: 0,
        relationshipLimit: 0,
      });
      return snapshot.subjectStateSchemaVersion;
    });
  },

  async setBootState(nextValue: {
    mode: RuntimeMode;
    schemaVersion: string;
    dependencyResults: Array<{
      dependency: string;
      ok: boolean;
      requiredForNormal: boolean;
      detail?: string;
    }>;
    degradedDependencies: string[];
    snapshotId: string | null;
  }): Promise<void> {
    await withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createTickRuntimeStore(client);
      await store.setBootState({
        mode: nextValue.mode,
        schemaVersion: nextValue.schemaVersion,
        dependencyResults: nextValue.dependencyResults,
        degradedDependencies: nextValue.degradedDependencies,
        snapshotId: nextValue.snapshotId,
      });
    });
  },

  async setDevelopmentFreeze(nextValue: boolean): Promise<void> {
    await withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createTickRuntimeStore(client);
      await store.setDevelopmentFreeze(nextValue);
    });
  },

  async setLastStableSnapshotId(nextValue: string): Promise<void> {
    await withRuntimeClient(config.postgresUrl, async (client) => {
      await client.query(
        `update polyphony_runtime.agent_state
         set last_stable_snapshot_id = $1,
             updated_at = now()
         where id = 1`,
        [nextValue],
      );
    });
  },
});

const createNoopLifecycleController = () => ({
  setState: (): Promise<void> => Promise.resolve(),
});

const createUnsupportedRecoveryGateway = (label: string) => ({
  restoreGitTag: (gitTag: string): Promise<void> => {
    void gitTag;
    return Promise.reject(new Error(`${label} is not available in the phase-0 runtime`));
  },
});

const createNoopModelRegistry = () => ({
  restoreProfileMap: (modelProfileMapJson: Record<string, string>): Promise<void> => {
    void modelProfileMapJson;
    return Promise.reject(
      new Error('model profile restore is not available in the phase-0 runtime'),
    );
  },
});

export function createPhase0RuntimeLifecycle(config: CoreRuntimeConfig): RuntimeLifecycle {
  let tickRuntime: TickRuntime | null = null;
  const fastModelHealthProbe = createFastModelHealthProbe(config);
  const resolveBaselineHealth = async (): Promise<
    Record<'reflex' | 'deliberation' | 'reflection', ModelHealthSummary>
  > => {
    const fastModelHealth = await fastModelHealthProbe();

    return {
      reflex: fastModelHealth,
      deliberation: fastModelHealth,
      reflection: fastModelHealth,
    };
  };
  const modelProfileStore = createDbBackedModelProfileStore(config);
  const modelRouter = createPhase0ModelRouter({
    fastModelBaseUrl: config.fastModelBaseUrl,
    store: modelProfileStore,
    resolveBaselineHealth,
  });
  const perceptionController = createPerceptionController({
    config,
    store: createDbBackedPerceptionStore(config),
    requestReactiveTick: async (input) => {
      if (!tickRuntime) {
        return {
          accepted: false,
          reason: 'boot_inactive',
        };
      }

      return await tickRuntime.requestTick(input);
    },
  });

  tickRuntime = createTickRuntime({
    store: createDbBackedTickRuntimeStore(config, {
      ensureBaselineProfiles: async () => {
        await modelRouter.ensureBaselineProfiles();
      },
    }),
    executeTick: createPhase0TickExecution({
      selectProfile: (input) => modelRouter.selectProfile(input),
      persistTickModelSelection: async (input) => {
        await modelProfileStore.persistTickModelSelection(input);
      },
      prepareReactiveTick: (tickId) => perceptionController.prepareReactiveTick(tickId),
    }),
  });

  let started = false;

  return {
    async start(): Promise<void> {
      if (started) return;

      await withRuntimeClient(config.postgresUrl, async (client) => {
        await ensureRuntimeAgentStateRow(client);
      });

      const expectedSchemaVersion = await withRuntimeClient(config.postgresUrl, readSchemaVersion);

      const bootService = new ConstitutionalBootService({
        expectedSchemaVersion,
        repoRoot: findRuntimeRoot(config),
        constitutionPath: config.seedConstitutionPath,
        dependencyProbes: createDependencyProbeMap(config),
        timeline: createTimelinePort(config),
        agentStateStore: createAgentStatePort(config),
        lifecycleController: createNoopLifecycleController(),
        developmentLedger: {
          record: (): Promise<void> => Promise.resolve(),
        },
        snapshotStore: {
          getLatestValidSnapshotId: (): Promise<string | null> => Promise.resolve(null),
          getSnapshotById: (): Promise<null> => Promise.resolve(null),
        },
        bodyGateway: createUnsupportedRecoveryGateway('git restore'),
        modelRegistry: createNoopModelRegistry(),
        scheduler: {
          start: async () => {
            await perceptionController.emitSchedulerSignal({
              signalType: 'scheduler.started',
              occurredAt: new Date().toISOString(),
              priority: 'low',
              payload: {
                driver: 'pg-boss',
                phase: 'boot',
              },
              dedupeKey: 'scheduler:started',
            });
          },
        },
        tickEngine: {
          start: () => tickRuntime.start(),
        },
        sensorAdapters: [
          {
            start: () => perceptionController.start(),
          },
        ],
      });

      try {
        const result = await bootService.boot();
        if (!result.ok) {
          throw result.error;
        }

        await perceptionController.emitSystemSignal({
          signalType: 'system.boot.completed',
          occurredAt: new Date().toISOString(),
          priority: 'high',
          payload: {
            mode: result.preflight.selectedMode,
            recoveryOutcome: result.recovery.outcome,
          },
        });

        started = true;
      } catch (error) {
        await perceptionController.stop().catch(() => {});
        if (tickRuntime) {
          await tickRuntime.stop().catch(() => {});
        }
        throw error;
      }
    },

    async stop(): Promise<void> {
      started = false;
      await perceptionController.stop();
      if (tickRuntime) {
        await tickRuntime.stop();
      }
    },

    async requestTick(input) {
      const result = await tickRuntime.requestTick(input);
      if (result.accepted) {
        return { accepted: true };
      }

      return {
        accepted: false,
        reason: result.reason,
      };
    },

    ingestHttpStimulus(input) {
      return perceptionController.ingestHttpStimulus(input);
    },

    async health(): Promise<PerceptionHealthSnapshot> {
      try {
        return await perceptionController.health();
      } catch {
        return DEFAULT_PERCEPTION_HEALTH;
      }
    },

    getModelRoutingDiagnostics(input?: {
      reflex?: ModelHealthSummary;
      deliberation?: ModelHealthSummary;
      reflection?: ModelHealthSummary;
    }): Promise<BaselineModelProfileDiagnostic[]> {
      return modelRouter.getBaselineDiagnostics(input ? { organHealth: input } : undefined);
    },
  };
}
