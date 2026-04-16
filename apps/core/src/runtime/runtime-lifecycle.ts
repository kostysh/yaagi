import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Client } from 'pg';
import { DEPENDENCY } from '@yaagi/contracts/boot';
import type { ExecutiveVerdict } from '@yaagi/contracts/actions';
import {
  createEmptyNarrativeMemeticOutputs,
  type DecisionMode,
  type DecisionResult,
  type NarrativeMemeticOutputs,
} from '@yaagi/contracts/cognition';
import type {
  ModelOrganHealthReportInput,
  OperatorRicherRegistryHealthSummary,
} from '@yaagi/contracts/models';
import {
  DEFAULT_PERCEPTION_HEALTH,
  type HttpIngestStimulusInput,
  type PerceptionBatch,
  type PerceptionHealthSnapshot,
} from '@yaagi/contracts/perception';
import {
  appendRuntimeTimelineEvent,
  createExpandedModelEcologyStore,
  createNarrativeMemeticStore,
  createRuntimeActionLogStore,
  createPerceptionStore,
  createRuntimeDbClient,
  createRuntimeModelProfileStore,
  type LifecycleActiveWorkRef,
  createTickRuntimeStore,
  ensureRuntimeAgentStateRow,
  getRuntimeAgentStateRow,
  type RuntimeEpisodePageInput,
  type RuntimeMode,
  type RuntimeEpisodeRow,
  type RuntimeTimelineEventPageInput,
  type RuntimeTimelineEventRow,
  type SubjectStateDelta,
  type SubjectStateSnapshot,
  type SubjectStateSnapshotInput,
} from '@yaagi/db';
import type { SystemEvent } from '@yaagi/contracts/boot';
import { TICK_STATUS, type TickTerminalResult } from '@yaagi/contracts/runtime';
import { GRACEFUL_SHUTDOWN_STATE } from '@yaagi/contracts/lifecycle';
import {
  createExecutiveCenter,
  createPhase0ToolGateway,
  executiveVerdictToResultJson,
} from '../actions/index.ts';
import { ConstitutionalBootService } from '../boot/index.ts';
import {
  createDecisionHarness,
  buildNarrativeMemeticCycle,
  DECISION_CONTEXT_LIMITS,
  type DecisionAgentInvoker,
} from '../cognition/index.ts';
import { createPerceptionController, type StimulusIngestResult } from '../perception/index.ts';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import { createPhase0DecisionInvoker } from '../platform/phase0-ai.ts';
import { createVllmFastBaselineProfiles } from '../platform/vllm-fast-manifest.ts';
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
import {
  createDbBackedHomeostatService,
  createPeriodicHomeostatWorker,
  type HomeostatService,
  type PeriodicHomeostatWorker,
} from './homeostat.ts';
import {
  createDbBackedLifecycleConsolidationService,
  type LifecycleConsolidationService,
} from './lifecycle-consolidation.ts';
import {
  createDbBackedDevelopmentGovernorService,
  type DevelopmentGovernorService,
} from './development-governor.ts';
import { createExpandedModelEcologyService } from './model-ecology.ts';
import {
  createDbBackedWorkshopService,
  createWorkshopWorker,
  type WorkshopWorker,
} from '../workshop/index.ts';
import type { WorkshopPromotionPackage } from '@yaagi/contracts/workshop';

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
    reason?: 'boot_inactive' | 'lease_busy' | 'unsupported_tick_kind' | 'shutdown_admission_closed';
  }>;
  freezeDevelopment(input: {
    requestId: string;
    reason: string;
    evidenceRefs: string[];
    requestedBy: 'operator_api';
    requestedAt: string;
  }): ReturnType<DevelopmentGovernorService['freezeDevelopment']>;
  submitDevelopmentProposal(input: {
    requestId: string;
    proposalKind: 'model_adapter' | 'specialist_model' | 'code_change' | 'policy_change';
    problemSignature: string;
    summary: string;
    evidenceRefs: string[];
    rollbackPlanRef: string | null;
    targetRef: string | null;
    requestedAt: string;
  }): ReturnType<DevelopmentGovernorService['submitDevelopmentProposal']>;
  submitWorkshopPromotionProposal(input: {
    requestId: string;
    promotionPackage: WorkshopPromotionPackage;
    packageUri: string;
    requestedAt: string;
  }): ReturnType<DevelopmentGovernorService['submitWorkshopPromotionProposal']>;
  recordProposalExecutionOutcome(input: {
    requestId: string;
    proposalId: string;
    outcomeKind: 'executed' | 'rolled_back';
    outcomeOrigin: 'runtime' | 'recovery' | 'workshop' | 'human_override';
    targetRef: string;
    evidenceRefs: string[];
    recordedAt: string;
  }): ReturnType<DevelopmentGovernorService['recordProposalExecutionOutcome']>;
  ingestHttpStimulus(input: HttpIngestStimulusInput): Promise<StimulusIngestResult>;
  health(): Promise<PerceptionHealthSnapshot>;
  getSubjectStateSnapshot(input?: SubjectStateSnapshotInput): Promise<SubjectStateSnapshot>;
  listTimelineEvents(input?: RuntimeTimelineEventPageInput): Promise<RuntimeTimelineEventRow[]>;
  listEpisodes(input?: RuntimeEpisodePageInput): Promise<RuntimeEpisodeRow[]>;
  getModelRoutingDiagnostics(input?: {
    reflex?: ModelHealthSummary;
    deliberation?: ModelHealthSummary;
    reflection?: ModelHealthSummary;
  }): Promise<BaselineModelProfileDiagnostic[]>;
  getRicherModelRegistryHealthSummary(): Promise<OperatorRicherRegistryHealthSummary>;
  getModelOrganHealthReportInput(): Promise<ModelOrganHealthReportInput>;
};

export const startBoundedWorkshopWorker = async (
  worker: WorkshopWorker,
  logError: (message: string, error: unknown) => void = console.error,
): Promise<boolean> => {
  try {
    await worker.start();
    return true;
  } catch (error) {
    logError('workshop worker failed to start; continuing in bounded degraded mode', error);
    return false;
  }
};

export const buildPhase0SubjectStateDelta = (input: FinishTickInput): SubjectStateDelta => {
  if (input.terminal.status !== TICK_STATUS.COMPLETED) {
    return {};
  }

  return {
    agentStatePatch: {
      psmJson: {
        lastCompletedTickId: input.tickId,
        lastCompletedSummary: input.terminal.summary ?? null,
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
    afterCompletedTick?: (input: { tickId: string; occurredAt: string }) => Promise<void>;
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
        ...(input.terminal.actionId ? { actionId: input.terminal.actionId } : {}),
        ...(Object.hasOwn(input.terminal, 'selectedCoalitionId')
          ? { selectedCoalitionId: input.terminal.selectedCoalitionId ?? null }
          : {}),
        ...(input.terminal.narrativeMemeticDelta
          ? { narrativeMemeticDelta: input.terminal.narrativeMemeticDelta }
          : {}),
      };

      if (input.terminal.status === TICK_STATUS.COMPLETED) {
        await store.completeTick({
          ...finalization,
          subjectStateDelta: buildPhase0SubjectStateDelta(input),
        });
        if (options.afterCompletedTick) {
          try {
            await options.afterCompletedTick({
              tickId: input.tickId,
              occurredAt: input.finishedAt,
            });
          } catch (error) {
            console.error('homeostat post-commit tick evaluation failed', error);
          }
        }
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

const createDbBackedExpandedModelEcologyStore = (config: CoreRuntimeConfig) => ({
  upsertProfileHealth: (
    entries: Parameters<
      ReturnType<typeof createExpandedModelEcologyStore>['upsertProfileHealth']
    >[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createExpandedModelEcologyStore(client);
      return await store.upsertProfileHealth(entries);
    }),

  replaceFallbackLinks: (
    entries: Parameters<
      ReturnType<typeof createExpandedModelEcologyStore>['replaceFallbackLinks']
    >[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createExpandedModelEcologyStore(client);
      return await store.replaceFallbackLinks(entries);
    }),

  listProfileHealth: (
    input?: Parameters<ReturnType<typeof createExpandedModelEcologyStore>['listProfileHealth']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createExpandedModelEcologyStore(client);
      return await store.listProfileHealth(input);
    }),

  listFallbackLinks: (
    input?: Parameters<ReturnType<typeof createExpandedModelEcologyStore>['listFallbackLinks']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createExpandedModelEcologyStore(client);
      return await store.listFallbackLinks(input);
    }),
});

const createDbBackedActionLogStore = (config: CoreRuntimeConfig) => ({
  appendActionLog: (
    input: Parameters<ReturnType<typeof createRuntimeActionLogStore>['appendActionLog']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createRuntimeActionLogStore(client);
      return await store.appendActionLog(input);
    }),

  listActionLogForTick: (
    input: Parameters<ReturnType<typeof createRuntimeActionLogStore>['listActionLogForTick']>[0],
  ) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createRuntimeActionLogStore(client);
      return await store.listActionLogForTick(input);
    }),
});

const reserveDbBackedTickActionId = (
  config: CoreRuntimeConfig,
  input: Parameters<ReturnType<typeof createTickRuntimeStore>['setTickActionId']>[0],
) =>
  withRuntimeClient(config.postgresUrl, async (client) => {
    const store = createTickRuntimeStore(client);
    await store.setTickActionId(input);
  });

const createEmptyPerceptionBatch = (tickId: string): PerceptionBatch => ({
  claimedStimulusIds: [],
  highestPriority: null,
  items: [],
  sourceKinds: [],
  requiresImmediateTick: false,
  tickId,
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
    prepareReactiveTick: (tickId: string) => Promise<PerceptionBatch>;
    loadSubjectStateSnapshot: (input: SubjectStateSnapshotInput) => Promise<SubjectStateSnapshot>;
    listRecentEpisodes: (input: { limit: number }) => Promise<RuntimeEpisodeRow[]>;
    prepareNarrativeMemeticCycle?: (input: {
      tickId: string;
      decisionMode: 'wake' | DecisionMode;
      subjectStateSnapshot: SubjectStateSnapshot;
      recentEpisodes: RuntimeEpisodeRow[];
      perceptionBatch: PerceptionBatch;
    }) => Promise<{
      outputs: NarrativeMemeticOutputs;
      meta: {
        truncated: boolean;
        sourceIds: string[];
        conflictMarkers: string[];
      };
      delta: NonNullable<TickTerminalResult['narrativeMemeticDelta']>;
      candidates: Array<{
        candidateId: string;
        abstractLabel: string;
        supportingRefs: string[];
        sourceKinds: Array<'stimulus' | 'episode' | 'goal' | 'belief' | 'entity' | 'journal'>;
        durablePromotionAllowed: false;
      }>;
      seededBaseline: boolean;
    }>;
    runDecision: (input: {
      tickId: string;
      decisionMode: DecisionMode;
      selectedProfile: {
        modelProfileId: string;
        role: 'reflex' | 'deliberation' | 'reflection';
        endpoint: string;
        adapterOf: string | null;
        eligibility?: 'eligible' | 'profile_unavailable' | 'profile_unhealthy';
      };
      subjectStateSnapshot: SubjectStateSnapshot;
      recentEpisodes: RuntimeEpisodeRow[];
      perceptionBatch?: PerceptionBatch;
      narrativeMemeticOutputs?: NarrativeMemeticOutputs;
      narrativeMemeticMeta?: {
        truncated: boolean;
        sourceIds: string[];
        conflictMarkers: string[];
      };
    }) => Promise<DecisionResult>;
    handleDecisionAction: (input: {
      tickId: string;
      decisionMode: DecisionMode;
      selectedModelProfileId: string;
      action: Extract<DecisionResult, { accepted: true }>['decision']['action'];
    }) => Promise<ExecutiveVerdict>;
    resolveSelectedProfileEligibility?: (input: {
      modelProfileId: string;
      role: 'reflex' | 'deliberation' | 'reflection';
      requiredCapabilities: string[];
    }) => Promise<'eligible' | 'profile_unavailable' | 'profile_unhealthy'>;
  }) =>
  async (context: StartedTick): Promise<TickTerminalResult> => {
    const subjectStateSnapshot = await dependencies.loadSubjectStateSnapshot({
      goalLimit: DECISION_CONTEXT_LIMITS.goalLimit,
      beliefLimit: DECISION_CONTEXT_LIMITS.beliefLimit,
      entityLimit: DECISION_CONTEXT_LIMITS.entityLimit,
      relationshipLimit: DECISION_CONTEXT_LIMITS.relationshipLimit,
    });
    const buildNarrativeMemeticFallback = () => ({
      outputs: createEmptyNarrativeMemeticOutputs(),
      meta: {
        truncated: false,
        sourceIds: [`tick:${context.tickId}:narrative:none`],
        conflictMarkers: ['no_winning_coalition'],
      },
      delta: {
        seedMemeticUnits: [],
        memeticUnitUpdates: [],
        memeticEdgeUpserts: [],
        coalition: null,
        narrativeVersion: null,
        fieldJournalEntries: [],
      },
      candidates: [],
      seededBaseline: false,
    });

    if (context.kind === 'wake') {
      const narrativeMemetic = dependencies.prepareNarrativeMemeticCycle
        ? await dependencies.prepareNarrativeMemeticCycle({
            tickId: context.tickId,
            decisionMode: 'wake',
            subjectStateSnapshot,
            recentEpisodes: [],
            perceptionBatch: createEmptyPerceptionBatch(context.tickId),
          })
        : buildNarrativeMemeticFallback();

      return {
        status: TICK_STATUS.COMPLETED,
        summary: 'Phase-0 wake tick completed',
        result: {
          kind: context.kind,
          trigger: context.trigger,
          narrativeMemetic: narrativeMemetic.outputs,
          narrativeTrace: {
            seededBaseline: narrativeMemetic.seededBaseline,
            candidateIds: narrativeMemetic.candidates.map((candidate) => candidate.candidateId),
          },
        },
        continuityFlags: {
          narrativeMemeticBootstrapSeeded: narrativeMemetic.seededBaseline,
        },
        narrativeMemeticDelta: narrativeMemetic.delta,
      };
    }

    const decisionMode = context.kind as DecisionMode;
    const routingInput = buildRoutingInputFromTick(context);
    const selection = await dependencies.selectProfile(routingInput);
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
        : createEmptyPerceptionBatch(context.tickId);

    const recentEpisodes = await dependencies.listRecentEpisodes({
      limit: DECISION_CONTEXT_LIMITS.recentEpisodeLimit,
    });
    const narrativeMemetic = dependencies.prepareNarrativeMemeticCycle
      ? await dependencies.prepareNarrativeMemeticCycle({
          tickId: context.tickId,
          decisionMode,
          subjectStateSnapshot,
          recentEpisodes,
          perceptionBatch,
        })
      : buildNarrativeMemeticFallback();
    const selectedProfileEligibility = dependencies.resolveSelectedProfileEligibility
      ? await dependencies.resolveSelectedProfileEligibility({
          modelProfileId: selection.modelProfileId,
          role: selection.role,
          requiredCapabilities: routingInput.requiredCapabilities ?? [],
        })
      : 'eligible';
    const decision = await dependencies.runDecision({
      tickId: context.tickId,
      decisionMode,
      selectedProfile: {
        modelProfileId: selection.modelProfileId,
        role: selection.role,
        endpoint: selection.endpoint,
        adapterOf: selection.adapterOf,
        eligibility: selectedProfileEligibility,
      },
      subjectStateSnapshot,
      recentEpisodes,
      perceptionBatch,
      narrativeMemeticOutputs: narrativeMemetic.outputs,
      narrativeMemeticMeta: narrativeMemetic.meta,
    });
    const decisionTrace = {
      decisionMode,
      subjectStateSchemaVersion: subjectStateSnapshot.subjectStateSchemaVersion,
      recentEpisodeIds: recentEpisodes.map((episode) => episode.episodeId),
      perceptualSourceIds: perceptionBatch.claimedStimulusIds,
      narrativeMemetic: {
        winningCoalitionId: narrativeMemetic.outputs.winningCoalition?.coalitionId ?? null,
        activeUnitIds: narrativeMemetic.outputs.activeMemeticUnits.map((unit) => unit.unitId),
        candidateIds: narrativeMemetic.candidates.map((candidate) => candidate.candidateId),
        conflictMarkers: narrativeMemetic.meta.conflictMarkers,
        seededBaseline: narrativeMemetic.seededBaseline,
      },
      validation: decision.accepted
        ? { accepted: true, schema: 'TickDecisionV1' }
        : {
            accepted: false,
            reason: decision.reason,
            detail: decision.detail,
          },
    };
    if (!decision.accepted) {
      return {
        status: TICK_STATUS.FAILED,
        summary: `${context.kind} tick refused before structured decision handoff`,
        failureDetail: `decision harness rejected: ${decision.reason}`,
        continuityFlags: {
          selectedModelProfileId: selection.modelProfileId,
          decisionRejected: {
            reason: decision.reason,
            detail: decision.detail,
          },
        },
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
          narrativeMemetic: narrativeMemetic.outputs,
          decisionTrace,
        },
      };
    }

    const buildResultPayload = (executiveVerdict: ExecutiveVerdict) => ({
      kind: context.kind,
      trigger: context.trigger,
      requestId: context.requestId,
      payload: context.payload,
      selectedModelProfileId: selection.modelProfileId,
      selectedRole: selection.role,
      modelEndpoint: selection.endpoint,
      selectionReason: selection.selectionReason,
      perceptionBatch,
      narrativeMemetic: narrativeMemetic.outputs,
      decision: decision.decision,
      decisionTrace,
      executive: executiveVerdict.accepted
        ? {
            accepted: true,
            actionId: executiveVerdict.actionId,
            verdictKind: executiveVerdict.verdictKind,
            boundaryCheck: executiveVerdict.boundaryCheck,
            resultJson: executiveVerdict.resultJson,
          }
        : {
            accepted: false,
            actionId: executiveVerdict.actionId,
            verdictKind: executiveVerdict.verdictKind,
            boundaryCheck: executiveVerdict.boundaryCheck,
            refusalReason: executiveVerdict.refusalReason,
            detail: executiveVerdict.detail,
            resultJson: executiveVerdictToResultJson(executiveVerdict),
          },
    });

    const executiveVerdict = await dependencies.handleDecisionAction({
      tickId: context.tickId,
      decisionMode,
      selectedModelProfileId: selection.modelProfileId,
      action: decision.decision.action,
    });

    if (!executiveVerdict.accepted) {
      return {
        status: TICK_STATUS.FAILED,
        summary: `${context.kind} tick refused by the executive boundary`,
        failureDetail: `executive boundary rejected: ${executiveVerdict.refusalReason}`,
        actionId: executiveVerdict.actionId,
        continuityFlags: {
          selectedModelProfileId: selection.modelProfileId,
          ...(narrativeMemetic.outputs.winningCoalition
            ? { selectedCoalitionId: narrativeMemetic.outputs.winningCoalition.coalitionId }
            : {}),
          executiveRejected: {
            reason: executiveVerdict.refusalReason,
            detail: executiveVerdict.detail,
          },
        },
        selectedCoalitionId: narrativeMemetic.outputs.winningCoalition?.coalitionId ?? null,
        narrativeMemeticDelta: narrativeMemetic.delta,
        result: buildResultPayload(executiveVerdict),
      };
    }

    return {
      status: TICK_STATUS.COMPLETED,
      summary: decision.decision.episode.summary,
      actionId: executiveVerdict.actionId,
      result: buildResultPayload(executiveVerdict),
      continuityFlags: {
        selectedModelProfileId: selection.modelProfileId,
        ...(narrativeMemetic.outputs.winningCoalition
          ? { selectedCoalitionId: narrativeMemetic.outputs.winningCoalition.coalitionId }
          : {}),
      },
      selectedCoalitionId: narrativeMemetic.outputs.winningCoalition?.coalitionId ?? null,
      narrativeMemeticDelta: narrativeMemetic.delta,
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

const buildShutdownWorkEvidenceRefs = (activeWork: LifecycleActiveWorkRef[]): string[] =>
  activeWork.length === 0
    ? ['runtime:shutdown:active-work:none']
    : activeWork.map((work) => `tick:${work.tickId}`);

const recordGracefulShutdownEvidence = async (
  service: LifecycleConsolidationService,
  input: {
    shutdownEventId: string;
    shutdownState: 'shutting_down' | 'completed';
    reason: string;
    schemaVersion: string;
    recordedAt: string;
    admittedInFlightWork: LifecycleActiveWorkRef[];
    terminalTickOutcome: Record<string, unknown>;
    flushedBufferResult: Record<string, unknown>;
    openConcerns: string[];
  },
): Promise<void> => {
  const result = await service.recordGracefulShutdown({
    shutdownEventId: input.shutdownEventId,
    shutdownState: input.shutdownState,
    reason: input.reason,
    subjectRef: 'runtime:polyphony-core',
    admittedInFlightWork: input.admittedInFlightWork.map((work) => ({ ...work })),
    terminalTickOutcome: input.terminalTickOutcome,
    flushedBufferResult: input.flushedBufferResult,
    openConcerns: input.openConcerns,
    evidenceRefs: [
      `runtime:shutdown:${input.shutdownState}`,
      ...buildShutdownWorkEvidenceRefs(input.admittedInFlightWork),
    ],
    recordedAt: input.recordedAt,
    schemaVersion: input.schemaVersion,
    idempotencyKey: `runtime:shutdown:${input.shutdownEventId}`,
  });

  if (!result.accepted) {
    throw new Error(`failed to persist graceful shutdown evidence: ${result.reason}`);
  }
};

export type GracefulShutdownSequencePorts = {
  closeAdmission(): void;
  closeTickAdmission(): Promise<void>;
  getSchemaVersion(): Promise<string>;
  listActiveTickWork(): Promise<LifecycleActiveWorkRef[]>;
  recordShutdownEvidence(input: {
    shutdownEventId: string;
    shutdownState: 'shutting_down' | 'completed';
    reason: string;
    schemaVersion: string;
    recordedAt: string;
    admittedInFlightWork: LifecycleActiveWorkRef[];
    terminalTickOutcome: Record<string, unknown>;
    flushedBufferResult: Record<string, unknown>;
    openConcerns: string[];
  }): Promise<void>;
  stopWorkshopWorker(): Promise<void>;
  stopPeriodicHomeostatWorker(): Promise<void>;
  stopPerceptionController(): Promise<void>;
  stopTickRuntime(): Promise<void>;
  now(): string;
  createShutdownId(): string;
};

export const runGracefulShutdownSequence = async (
  ports: GracefulShutdownSequencePorts,
): Promise<void> => {
  const shutdownRequestedAt = ports.now();
  const shutdownId = ports.createShutdownId();

  ports.closeAdmission();
  await ports.closeTickAdmission();

  const schemaVersion = await ports.getSchemaVersion();
  const admittedInFlightWork = await ports.listActiveTickWork();

  await ports.recordShutdownEvidence({
    shutdownEventId: `${shutdownId}:requested`,
    shutdownState: GRACEFUL_SHUTDOWN_STATE.SHUTTING_DOWN,
    reason: 'runtime.stop',
    schemaVersion,
    recordedAt: shutdownRequestedAt,
    admittedInFlightWork,
    terminalTickOutcome: {},
    flushedBufferResult: {},
    openConcerns: [],
  });

  await ports.stopWorkshopWorker();
  await ports.stopPeriodicHomeostatWorker();
  await ports.stopPerceptionController();
  await ports.stopTickRuntime();

  const remainingActiveWork = await ports.listActiveTickWork();
  await ports.recordShutdownEvidence({
    shutdownEventId: `${shutdownId}:completed`,
    shutdownState: GRACEFUL_SHUTDOWN_STATE.COMPLETED,
    reason: 'runtime.stop',
    schemaVersion,
    recordedAt: ports.now(),
    admittedInFlightWork,
    terminalTickOutcome: {
      remainingActiveTickIds: remainingActiveWork.map((work) => work.tickId),
      activeTickCountBeforeStop: admittedInFlightWork.length,
      activeTickCountAfterStop: remainingActiveWork.length,
    },
    flushedBufferResult: {
      workshopWorker: 'stopped',
      periodicHomeostatWorker: 'stopped',
      perceptionController: 'stopped',
      tickRuntime: 'stopped',
    },
    openConcerns: remainingActiveWork.map((work) => `active_tick_remaining:${work.tickId}`),
  });
};

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

export function createPhase0RuntimeLifecycle(
  config: CoreRuntimeConfig,
  options: {
    invokeDecision?: DecisionAgentInvoker;
  } = {},
): RuntimeLifecycle {
  let tickRuntime: TickRuntime | null = null;
  const developmentGovernor: DevelopmentGovernorService =
    createDbBackedDevelopmentGovernorService(config);
  const homeostatService: HomeostatService = createDbBackedHomeostatService(config, {
    handleReactionRequest: async (request) => {
      await developmentGovernor.applyHomeostatReaction(request);
    },
  });
  const lifecycleConsolidation = createDbBackedLifecycleConsolidationService(config);
  const periodicHomeostatWorker: PeriodicHomeostatWorker = createPeriodicHomeostatWorker(
    config,
    homeostatService,
  );
  const workshopService = createDbBackedWorkshopService(config);
  const workshopWorker: WorkshopWorker = createWorkshopWorker(config, workshopService);
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
  const expandedModelEcologyStore = createDbBackedExpandedModelEcologyStore(config);
  const actionLogStore = createDbBackedActionLogStore(config);
  const modelRouter = createPhase0ModelRouter({
    fastModelBaseUrl: config.fastModelBaseUrl,
    baselineProfiles: createVllmFastBaselineProfiles(config),
    store: modelProfileStore,
    resolveBaselineHealth,
  });
  const expandedModelEcology = createExpandedModelEcologyService({
    deepModelBaseUrl: config.deepModelBaseUrl,
    poolModelBaseUrl: config.poolModelBaseUrl,
    modelProfileStore,
    store: expandedModelEcologyStore,
  });
  const invokeDecision = options.invokeDecision ?? createPhase0DecisionInvoker();
  const decisionHarness = createDecisionHarness({
    invokeAgent: invokeDecision,
    limits: DECISION_CONTEXT_LIMITS,
  });
  const toolGateway = createPhase0ToolGateway({ config });
  const executiveCenter = createExecutiveCenter({
    actionLogStore,
    toolGateway,
    reserveActionId: (input) => reserveDbBackedTickActionId(config, input),
  });
  const perceptionController = createPerceptionController({
    config,
    store: createDbBackedPerceptionStore(config),
    requestReactiveTick: async (input) => {
      if (shuttingDown) {
        return {
          accepted: false,
          reason: 'shutdown_admission_closed',
        };
      }

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
      afterCompletedTick: async ({ tickId, occurredAt }) => {
        await homeostatService.evaluateTickComplete({
          tickId,
          createdAt: occurredAt,
        });
      },
    }),
    executeTick: createPhase0TickExecution({
      selectProfile: (input) => modelRouter.selectProfile(input),
      persistTickModelSelection: async (input) => {
        await modelProfileStore.persistTickModelSelection(input);
      },
      prepareReactiveTick: (tickId) => perceptionController.prepareReactiveTick(tickId),
      loadSubjectStateSnapshot: (input) =>
        withRuntimeClient(config.postgresUrl, async (client) => {
          const store = createTickRuntimeStore(client);
          return await store.loadSubjectStateSnapshot(input);
        }),
      listRecentEpisodes: (input) =>
        withRuntimeClient(config.postgresUrl, async (client) => {
          const store = createTickRuntimeStore(client);
          return await store.listRecentEpisodes(input);
        }),
      prepareNarrativeMemeticCycle: (input) =>
        withRuntimeClient(config.postgresUrl, async (client) => {
          const narrativeStore = createNarrativeMemeticStore(client);
          const snapshot = await narrativeStore.loadSnapshot();

          return buildNarrativeMemeticCycle({
            tickId: input.tickId,
            decisionMode: input.decisionMode,
            perceptionSummary: {
              stimulusRefs: input.perceptionBatch.claimedStimulusIds,
              urgency:
                input.perceptionBatch.highestPriority === 'critical'
                  ? 1
                  : input.perceptionBatch.highestPriority === 'high'
                    ? 0.8
                    : input.perceptionBatch.highestPriority === 'normal'
                      ? 0.55
                      : input.perceptionBatch.highestPriority === 'low'
                        ? 0.25
                        : 0,
              novelty:
                input.perceptionBatch.items.length === 0
                  ? 0
                  : Math.max(
                      0,
                      Math.min(
                        1,
                        input.perceptionBatch.items.reduce(
                          (total, item) => total + item.coalescedCount,
                          0,
                        ) /
                          (input.perceptionBatch.items.length * 4),
                      ),
                    ),
              resourcePressure: Math.max(
                0,
                Math.min(
                  1,
                  Number(
                    input.subjectStateSnapshot.agentState.resourcePostureJson['pressure'] ?? 0,
                  ) ||
                    Number(
                      input.subjectStateSnapshot.agentState.resourcePostureJson['cpuLoad'] ?? 0,
                    ) ||
                    Number(
                      input.subjectStateSnapshot.agentState.resourcePostureJson['memoryPressure'] ??
                        0,
                    ) ||
                    0,
                ),
              ),
              summary:
                input.perceptionBatch.items.length === 0
                  ? 'no claimed stimuli'
                  : `${input.perceptionBatch.items.length} claimed stimuli`,
            },
            subjectStateSnapshot: {
              subjectStateSchemaVersion: input.subjectStateSnapshot.subjectStateSchemaVersion,
              goals: input.subjectStateSnapshot.goals.map((goal) => ({ ...goal })),
              beliefs: input.subjectStateSnapshot.beliefs.map((belief) => ({ ...belief })),
              entities: input.subjectStateSnapshot.entities.map((entity) => ({ ...entity })),
              relationships: input.subjectStateSnapshot.relationships.map((relationship) => ({
                ...relationship,
              })),
              agentState: { ...input.subjectStateSnapshot.agentState },
            },
            recentEpisodes: input.recentEpisodes.map((episode) => ({
              episodeId: episode.episodeId,
              tickId: episode.tickId,
              summary: episode.summary,
              sourceRefs: [`episode:${episode.episodeId}`],
            })),
            activeMemeticUnits: snapshot.activeUnits.map((unit) => ({
              unitId: unit.unitId,
              label: unit.abstractLabel,
              activation: unit.activationScore,
              reinforcement: unit.reinforcementScore,
              decay: unit.decayScore,
              provenanceAnchors: unit.provenanceAnchorsJson,
            })),
            fieldJournalExcerpts: snapshot.recentFieldJournalEntries.map((entry) => ({
              entryId: entry.entryId,
              summary: entry.summary,
              tensionMarkers: entry.tensionMarkersJson,
              provenanceAnchors: entry.provenanceAnchorsJson,
            })),
            resourcePostureJson: { ...input.subjectStateSnapshot.agentState.resourcePostureJson },
            previousNarrative: snapshot.latestNarrativeVersion
              ? {
                  versionId: snapshot.latestNarrativeVersion.versionId,
                  currentChapter: snapshot.latestNarrativeVersion.currentChapter,
                  continuityDirection: snapshot.latestNarrativeVersion.continuityDirection,
                  summary: snapshot.latestNarrativeVersion.summary,
                }
              : null,
          });
        }),
      runDecision: (input) => decisionHarness.run(input),
      handleDecisionAction: (input) => executiveCenter.handleDecisionAction(input),
      resolveSelectedProfileEligibility: async (input) => {
        const profiles = await modelProfileStore.listModelProfiles({
          roles: [input.role],
        });
        const selectedProfile = profiles.find(
          (profile) => profile.modelProfileId === input.modelProfileId,
        );

        if (!selectedProfile) {
          return 'profile_unavailable';
        }

        if (selectedProfile.status === 'disabled') {
          return 'profile_unavailable';
        }

        if (
          input.requiredCapabilities.some(
            (capability) => !selectedProfile.capabilitiesJson.includes(capability),
          )
        ) {
          return 'profile_unavailable';
        }

        const organHealth = await resolveBaselineHealth();
        const healthSummary = organHealth[input.role];

        return healthSummary?.healthy === false ? 'profile_unhealthy' : 'eligible';
      },
    }),
  });

  let started = false;
  let shuttingDown = false;
  let runtimeSchemaVersion: string | null = null;
  const getRicherModelRegistryHealthSummary =
    async (): Promise<OperatorRicherRegistryHealthSummary> => {
      const summary = await expandedModelEcology.getOperatorRicherRegistryHealthSummary();
      if (summary.generatedAt) {
        return summary;
      }

      return await expandedModelEcology.syncRicherSourceDiagnostics();
    };
  const getModelOrganHealthReportInput = async (): Promise<ModelOrganHealthReportInput> => {
    const summary = await getRicherModelRegistryHealthSummary();
    return {
      generatedAt: summary.generatedAt ?? new Date().toISOString(),
      profiles: summary.organs.map((organ) => ({
        modelProfileId: organ.modelProfileId,
        role: organ.role,
        serviceId: organ.serviceId,
        availability: organ.availability,
        quarantineState: organ.quarantineState,
        fallbackTargetProfileId: organ.fallbackTargetProfileId,
        errorRate: organ.errorRate,
        latencyMsP95: organ.latencyMsP95,
      })),
    };
  };

  return {
    async start(): Promise<void> {
      if (started) return;
      shuttingDown = false;

      await withRuntimeClient(config.postgresUrl, async (client) => {
        await ensureRuntimeAgentStateRow(client);
      });

      const expectedSchemaVersion = await withRuntimeClient(config.postgresUrl, readSchemaVersion);
      runtimeSchemaVersion = expectedSchemaVersion;

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

        await developmentGovernor.recoverActiveFreeze();
        await expandedModelEcology.syncRicherSourceDiagnostics();
        await startBoundedWorkshopWorker(workshopWorker);
        await periodicHomeostatWorker.start();

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
        await workshopWorker.stop().catch(() => {});
        await periodicHomeostatWorker.stop().catch(() => {});
        await perceptionController.stop().catch(() => {});
        if (tickRuntime) {
          await tickRuntime.stop().catch(() => {});
        }
        throw error;
      }
    },

    async stop(): Promise<void> {
      if (shuttingDown && !started) {
        return;
      }

      await runGracefulShutdownSequence({
        closeAdmission: () => {
          shuttingDown = true;
          started = false;
        },
        closeTickAdmission: async () => {
          if (tickRuntime) {
            await tickRuntime.closeAdmission();
          }
        },
        getSchemaVersion: async () =>
          runtimeSchemaVersion ?? (await withRuntimeClient(config.postgresUrl, readSchemaVersion)),
        listActiveTickWork: () => lifecycleConsolidation.listActiveTickWork(),
        recordShutdownEvidence: (input) =>
          recordGracefulShutdownEvidence(lifecycleConsolidation, input),
        stopWorkshopWorker: async () => {
          await workshopWorker.stop().catch(() => {});
        },
        stopPeriodicHomeostatWorker: async () => {
          await periodicHomeostatWorker.stop().catch(() => {});
        },
        stopPerceptionController: () => perceptionController.stop(),
        stopTickRuntime: async () => {
          if (tickRuntime) {
            await tickRuntime.stop();
          }
        },
        now: () => new Date().toISOString(),
        createShutdownId: () => `shutdown:${randomUUID()}`,
      });
    },

    async requestTick(input) {
      if (shuttingDown) {
        return {
          accepted: false,
          reason: 'shutdown_admission_closed',
        };
      }

      const result = await tickRuntime.requestTick(input);
      if (result.accepted) {
        return { accepted: true };
      }

      return {
        accepted: false,
        reason: result.reason,
      };
    },

    freezeDevelopment(input) {
      return developmentGovernor.freezeDevelopment(input);
    },

    submitDevelopmentProposal(input) {
      return developmentGovernor.submitDevelopmentProposal(input);
    },

    submitWorkshopPromotionProposal(input) {
      return developmentGovernor.submitWorkshopPromotionProposal(input);
    },

    recordProposalExecutionOutcome(input) {
      return developmentGovernor.recordProposalExecutionOutcome(input);
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

    getSubjectStateSnapshot(input?: SubjectStateSnapshotInput): Promise<SubjectStateSnapshot> {
      return withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createTickRuntimeStore(client);
        return await store.loadSubjectStateSnapshot(input);
      });
    },

    listTimelineEvents(input?: RuntimeTimelineEventPageInput): Promise<RuntimeTimelineEventRow[]> {
      return withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createTickRuntimeStore(client);
        return await store.listTimelineEventsPage(input);
      });
    },

    listEpisodes(input?: RuntimeEpisodePageInput): Promise<RuntimeEpisodeRow[]> {
      return withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createTickRuntimeStore(client);
        return await store.listEpisodesPage(input);
      });
    },

    getModelRoutingDiagnostics(input?: {
      reflex?: ModelHealthSummary;
      deliberation?: ModelHealthSummary;
      reflection?: ModelHealthSummary;
    }): Promise<BaselineModelProfileDiagnostic[]> {
      return modelRouter.getBaselineDiagnostics(input ? { organHealth: input } : undefined);
    },

    getRicherModelRegistryHealthSummary,
    getModelOrganHealthReportInput,
  };
}
