import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { TickRequestResult } from '@yaagi/contracts/runtime';
import {
  ADAPTER_HEALTH_STATUS,
  DEFAULT_PERCEPTION_BACKLOG_COUNTS,
  DEFAULT_PERCEPTION_HEALTH,
  SENSOR_SOURCE,
  STIMULUS_PRIORITY,
  STIMULUS_STATUS,
  buildStimulusEnvelope,
  getStimulusPriorityRank,
  httpIngestStimulusSchema,
  type AdapterHealthSnapshot,
  type HttpIngestStimulusInput,
  type PerceptionBacklogCounts,
  type PerceptionBatch,
  type PerceptionBatchItem,
  type PerceptionHealthSnapshot,
  type SensorSignal,
  type SensorSource,
  type StimulusInboxRecord,
} from '@yaagi/contracts/perception';
import type { PerceptionStore } from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import { createFilesystemAdapter } from './filesystem-adapter.ts';
import { createResourceAdapter } from './resource-adapter.ts';
import { createSchedulerAdapter } from './scheduler-adapter.ts';
import { createTelegramAdapter } from './telegram-adapter.ts';
import type { SensorAdapterRuntime } from './adapters.ts';

const READY_SCAN_LIMIT = 64;
const CLAIM_GROUP_LIMIT = 16;

const SOURCE_ORDER: SensorSource[] = [
  SENSOR_SOURCE.HTTP,
  SENSOR_SOURCE.FILE,
  SENSOR_SOURCE.TELEGRAM,
  SENSOR_SOURCE.SCHEDULER,
  SENSOR_SOURCE.RESOURCE,
  SENSOR_SOURCE.SYSTEM,
];

export type StimulusIngestResult = {
  stimulusId: string;
  deduplicated: boolean;
  tickAdmission?: TickRequestResult;
};

export type PerceptionController = {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<PerceptionHealthSnapshot>;
  ingestSignal(signal: SensorSignal): Promise<StimulusIngestResult>;
  ingestHttpStimulus(input: HttpIngestStimulusInput): Promise<StimulusIngestResult>;
  emitSystemSignal(input: Omit<SensorSignal, 'source'>): Promise<StimulusIngestResult>;
  emitSchedulerSignal(input: Omit<SensorSignal, 'source'>): Promise<StimulusIngestResult>;
  prepareReactiveTick(tickId: string): Promise<PerceptionBatch>;
};

type ControllerOptions = {
  config: CoreRuntimeConfig;
  store: Pick<
    PerceptionStore,
    | 'attachTickPerceptionClaim'
    | 'claimStimuli'
    | 'countBacklog'
    | 'enqueueStimulus'
    | 'findLatestBySourceAndDedupeKey'
    | 'loadReadyStimuli'
    | 'releaseClaimedStimuli'
    | 'updateQueuedStimulus'
  >;
  requestReactiveTick: (input: {
    requestId: string;
    kind: 'reactive';
    trigger: 'system';
    requestedAt: string;
    payload: Record<string, unknown>;
  }) => Promise<TickRequestResult>;
  now?: () => string;
  createId?: () => string;
  // Test-only hooks for deterministic adapter verification without widening the runtime config.
  testOverrides?: {
    filesystemWatchPaths?: string[];
    filesystemRepoRoot?: string;
    resourceIntervalMs?: number;
    resourceSamplePressure?: () => 'normal' | 'high' | 'critical';
    telegramPollTimeoutSeconds?: number;
  };
};

type CoalescedStimulusGroup = {
  primary: StimulusInboxRecord;
  stimulusIds: string[];
  entityRefs: string[];
  signalType: string;
  dedupeKey: string | null;
  coalescedCount: number;
};

const buildDefaultAdapterSnapshots = (
  telegramEnabled: boolean,
): Map<SensorSource, AdapterHealthSnapshot> =>
  new Map(
    SOURCE_ORDER.map((source) => [
      source,
      {
        source,
        status:
          source === SENSOR_SOURCE.HTTP
            ? ADAPTER_HEALTH_STATUS.HEALTHY
            : source === SENSOR_SOURCE.TELEGRAM && telegramEnabled
              ? ADAPTER_HEALTH_STATUS.DISABLED
              : source === SENSOR_SOURCE.TELEGRAM
                ? ADAPTER_HEALTH_STATUS.DISABLED
                : ADAPTER_HEALTH_STATUS.DISABLED,
      },
    ]),
  );

const compareStimuli = (left: StimulusInboxRecord, right: StimulusInboxRecord): number => {
  const immediateDelta = Number(right.requiresImmediateTick) - Number(left.requiresImmediateTick);
  if (immediateDelta !== 0) {
    return immediateDelta;
  }

  const priorityDelta = right.priorityRank - left.priorityRank;
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const occurredAtDelta = left.occurredAt.localeCompare(right.occurredAt);
  if (occurredAtDelta !== 0) {
    return occurredAtDelta;
  }

  return left.stimulusId.localeCompare(right.stimulusId);
};

const toBatchItem = (group: CoalescedStimulusGroup): PerceptionBatchItem => ({
  stimulusIds: [...group.stimulusIds],
  primaryStimulusId: group.primary.stimulusId,
  source: group.primary.sourceKind,
  signalType: group.signalType,
  occurredAt: group.primary.occurredAt,
  priority: group.primary.priority,
  requiresImmediateTick: group.primary.requiresImmediateTick,
  threadId: group.primary.threadId,
  entityRefs: [...group.entityRefs],
  payload: group.primary.normalizedJson.envelope.payload,
  dedupeKey: group.dedupeKey,
  coalescedCount: group.coalescedCount,
});

const coalesceReadyStimuli = (rows: StimulusInboxRecord[]): CoalescedStimulusGroup[] => {
  const groups = new Map<string, CoalescedStimulusGroup>();

  for (const row of rows) {
    const signalType = row.normalizedJson.signalType;
    const key = row.dedupeKey ?? `stimulus:${row.stimulusId}`;
    const existing = groups.get(key);
    const entityRefs = row.normalizedJson.envelope.entityRefs;

    if (!existing) {
      groups.set(key, {
        primary: row,
        stimulusIds: [row.stimulusId],
        entityRefs: [...entityRefs],
        signalType,
        dedupeKey: row.dedupeKey ?? null,
        coalescedCount: 1,
      });
      continue;
    }

    existing.stimulusIds.push(row.stimulusId);
    existing.coalescedCount += 1;
    for (const entityRef of entityRefs) {
      if (!existing.entityRefs.includes(entityRef)) {
        existing.entityRefs.push(entityRef);
      }
    }

    if (compareStimuli(row, existing.primary) >= 0) {
      continue;
    }

    existing.primary = row;
    existing.signalType = signalType;
  }

  return [...groups.values()].sort((left, right) => compareStimuli(left.primary, right.primary));
};

const buildFilesystemWatchPaths = (config: CoreRuntimeConfig): string[] => [
  config.workspaceBodyPath,
  config.workspaceSkillsPath,
  path.join(config.dataPath, 'datasets'),
  path.join(config.dataPath, 'reports'),
  path.join(config.dataPath, 'snapshots'),
];

const chooseStrongerPriority = (
  left: StimulusInboxRecord['priority'],
  right: StimulusInboxRecord['priority'],
): StimulusInboxRecord['priority'] =>
  getStimulusPriorityRank(left) >= getStimulusPriorityRank(right) ? left : right;

const isUrgentStimulus = (input: {
  priority: StimulusInboxRecord['priority'];
  requiresImmediateTick: boolean;
}): boolean => input.requiresImmediateTick || input.priority === STIMULUS_PRIORITY.CRITICAL;

const isStrongerThanExisting = (existing: StimulusInboxRecord, incoming: StimulusInboxRecord) =>
  incoming.priorityRank > existing.priorityRank ||
  (incoming.requiresImmediateTick && !existing.requiresImmediateTick);

export function createPerceptionController(options: ControllerOptions): PerceptionController {
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? randomUUID;
  const adapterSnapshots = buildDefaultAdapterSnapshots(options.config.telegramEnabled);
  let started = false;

  const reportAdapterStatus = (snapshot: AdapterHealthSnapshot): void => {
    adapterSnapshots.set(snapshot.source, snapshot);
  };

  const ingestSignal = async (signal: SensorSignal): Promise<StimulusIngestResult> => {
    const occurredAt = signal.occurredAt ?? now();
    const priority =
      signal.priority ??
      (signal.requiresImmediateTick ? STIMULUS_PRIORITY.CRITICAL : STIMULUS_PRIORITY.NORMAL);
    const envelope = buildStimulusEnvelope({
      id: createId(),
      source: signal.source,
      occurredAt,
      priority,
      threadId: signal.threadId ?? null,
      entityRefs: signal.entityRefs ?? [],
      requiresImmediateTick:
        signal.requiresImmediateTick ?? priority === STIMULUS_PRIORITY.CRITICAL,
      payload: signal.payload,
      reliability: signal.reliability ?? 1,
    });

    if (signal.dedupeKey) {
      const existing = await options.store.findLatestBySourceAndDedupeKey({
        sourceKind: signal.source,
        dedupeKey: signal.dedupeKey,
        ...(signal.source === SENSOR_SOURCE.TELEGRAM
          ? {}
          : {
              statuses: [STIMULUS_STATUS.QUEUED, STIMULUS_STATUS.CLAIMED],
            }),
      });
      if (existing) {
        const incoming: StimulusInboxRecord = {
          stimulusId: envelope.id,
          sourceKind: envelope.source,
          threadId: envelope.threadId ?? null,
          occurredAt: envelope.occurredAt,
          priority: envelope.priority,
          priorityRank: getStimulusPriorityRank(envelope.priority),
          requiresImmediateTick: envelope.requiresImmediateTick,
          payloadJson: envelope.payload,
          normalizedJson: {
            envelope,
            signalType: signal.signalType,
            dedupeKey: signal.dedupeKey ?? null,
            aggregateHints: signal.aggregateHints ?? {},
          },
          dedupeKey: signal.dedupeKey ?? null,
          claimTickId: null,
          status: STIMULUS_STATUS.QUEUED,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        };

        if (
          existing.status === STIMULUS_STATUS.CLAIMED &&
          signal.source !== SENSOR_SOURCE.TELEGRAM &&
          isStrongerThanExisting(existing, incoming)
        ) {
          // Fall through to enqueue a new queued row so a stronger follow-up signal survives the
          // active claim window instead of being swallowed by the older claimed row.
        } else {
          let target = existing;

          if (
            existing.status === STIMULUS_STATUS.QUEUED &&
            signal.source !== SENSOR_SOURCE.TELEGRAM
          ) {
            const existingWasUrgent = isUrgentStimulus(existing);
            const existingEnvelope = existing.normalizedJson.envelope;
            const mergedEnvelope = buildStimulusEnvelope({
              id: existing.stimulusId,
              source: existing.sourceKind,
              occurredAt:
                existing.occurredAt.localeCompare(envelope.occurredAt) <= 0
                  ? existing.occurredAt
                  : envelope.occurredAt,
              priority: chooseStrongerPriority(existing.priority, envelope.priority),
              threadId: existing.threadId ?? envelope.threadId ?? null,
              entityRefs: [...new Set([...existingEnvelope.entityRefs, ...envelope.entityRefs])],
              requiresImmediateTick:
                existing.requiresImmediateTick || envelope.requiresImmediateTick,
              payload: {
                ...existing.payloadJson,
                ...envelope.payload,
              },
              reliability: Math.max(existingEnvelope.reliability, envelope.reliability),
            });
            const merged = await options.store.updateQueuedStimulus({
              stimulusId: existing.stimulusId,
              envelope: mergedEnvelope,
              signalType: signal.signalType,
              dedupeKey: signal.dedupeKey,
              aggregateHints: {
                ...existing.normalizedJson.aggregateHints,
                ...(signal.aggregateHints ?? {}),
              },
            });
            if (merged) {
              target = merged;
              if (isUrgentStimulus(merged) && !existingWasUrgent) {
                const tickAdmission = await options.requestReactiveTick({
                  requestId: `perception:${merged.stimulusId}`,
                  kind: 'reactive',
                  trigger: 'system',
                  requestedAt: now(),
                  payload: {
                    source: 'perception',
                    rootStimulusId: merged.stimulusId,
                    sourceKinds: [merged.sourceKind],
                  },
                });

                reportAdapterStatus({
                  source: signal.source,
                  status: ADAPTER_HEALTH_STATUS.HEALTHY,
                  lastSignalAt: target.updatedAt,
                });
                return {
                  stimulusId: target.stimulusId,
                  deduplicated: true,
                  tickAdmission,
                };
              }
            }
          }

          reportAdapterStatus({
            source: signal.source,
            status: ADAPTER_HEALTH_STATUS.HEALTHY,
            lastSignalAt: target.updatedAt,
          });
          return {
            stimulusId: target.stimulusId,
            deduplicated: true,
          };
        }
      }
    }

    const row = await options.store.enqueueStimulus({
      envelope,
      signalType: signal.signalType,
      dedupeKey: signal.dedupeKey ?? null,
      aggregateHints: signal.aggregateHints ?? {},
    });

    reportAdapterStatus({
      source: signal.source,
      status: ADAPTER_HEALTH_STATUS.HEALTHY,
      lastSignalAt: row.occurredAt,
    });

    if (!row.requiresImmediateTick && row.priority !== STIMULUS_PRIORITY.CRITICAL) {
      return {
        stimulusId: row.stimulusId,
        deduplicated: false,
      };
    }

    const tickAdmission = await options.requestReactiveTick({
      requestId: `perception:${row.stimulusId}`,
      kind: 'reactive',
      trigger: 'system',
      requestedAt: now(),
      payload: {
        source: 'perception',
        rootStimulusId: row.stimulusId,
        sourceKinds: [row.sourceKind],
      },
    });

    return {
      stimulusId: row.stimulusId,
      deduplicated: false,
      tickAdmission,
    };
  };

  const schedulerAdapter = createSchedulerAdapter({
    emitSignal: ingestSignal,
    reportStatus: reportAdapterStatus,
    now,
  });

  const adapters: SensorAdapterRuntime[] = [
    schedulerAdapter,
    createFilesystemAdapter({
      emitSignal: ingestSignal,
      reportStatus: reportAdapterStatus,
      watchPaths:
        options.testOverrides?.filesystemWatchPaths ?? buildFilesystemWatchPaths(options.config),
      repoRoot: options.testOverrides?.filesystemRepoRoot ?? process.cwd(),
      now,
    }),
    createResourceAdapter({
      emitSignal: ingestSignal,
      reportStatus: reportAdapterStatus,
      now,
      ...(options.testOverrides?.resourceIntervalMs === undefined
        ? {}
        : {
            intervalMs: options.testOverrides.resourceIntervalMs,
          }),
      ...(options.testOverrides?.resourceSamplePressure === undefined
        ? {}
        : {
            samplePressure: options.testOverrides.resourceSamplePressure,
          }),
    }),
    createTelegramAdapter({
      enabled: options.config.telegramEnabled,
      botToken: options.config.telegramBotToken,
      allowedChatIds: options.config.telegramAllowedChatIds,
      apiBaseUrl: options.config.telegramApiBaseUrl,
      emitSignal: ingestSignal,
      reportStatus: reportAdapterStatus,
      now,
      ...(options.testOverrides?.telegramPollTimeoutSeconds === undefined
        ? {}
        : {
            pollTimeoutSeconds: options.testOverrides.telegramPollTimeoutSeconds,
          }),
    }),
  ];

  reportAdapterStatus({
    source: SENSOR_SOURCE.SYSTEM,
    status: ADAPTER_HEALTH_STATUS.DISABLED,
  });

  return {
    async start(): Promise<void> {
      if (started) {
        return;
      }

      started = true;
      reportAdapterStatus({
        source: SENSOR_SOURCE.SYSTEM,
        status: ADAPTER_HEALTH_STATUS.HEALTHY,
      });

      for (const adapter of adapters) {
        await adapter.start();
      }
    },

    async stop(): Promise<void> {
      started = false;
      for (const adapter of adapters) {
        await adapter.stop();
      }
      reportAdapterStatus({
        source: SENSOR_SOURCE.SYSTEM,
        status: ADAPTER_HEALTH_STATUS.DISABLED,
      });
    },

    async health(): Promise<PerceptionHealthSnapshot> {
      let backlog: PerceptionBacklogCounts = DEFAULT_PERCEPTION_BACKLOG_COUNTS;
      try {
        backlog = await options.store.countBacklog();
      } catch {
        backlog = DEFAULT_PERCEPTION_BACKLOG_COUNTS;
      }

      return {
        adapters: SOURCE_ORDER.map(
          (source) =>
            adapterSnapshots.get(source) ??
            DEFAULT_PERCEPTION_HEALTH.adapters.find((entry) => entry.source === source) ?? {
              source,
              status: ADAPTER_HEALTH_STATUS.DISABLED,
            },
        ),
        backlog,
      };
    },

    ingestSignal,

    ingestHttpStimulus(input: HttpIngestStimulusInput): Promise<StimulusIngestResult> {
      const parsed = httpIngestStimulusSchema.parse(input);
      return ingestSignal({
        ...parsed,
        source: SENSOR_SOURCE.HTTP,
      });
    },

    emitSystemSignal(input: Omit<SensorSignal, 'source'>): Promise<StimulusIngestResult> {
      return ingestSignal({
        ...input,
        source: SENSOR_SOURCE.SYSTEM,
      });
    },

    emitSchedulerSignal(input: Omit<SensorSignal, 'source'>): Promise<StimulusIngestResult> {
      return schedulerAdapter.emitRuntimeSignal(input) as Promise<StimulusIngestResult>;
    },

    async prepareReactiveTick(tickId: string): Promise<PerceptionBatch> {
      const readyRows = await options.store.loadReadyStimuli({
        limit: READY_SCAN_LIMIT,
      });
      const selectedGroups = coalesceReadyStimuli(readyRows).slice(0, CLAIM_GROUP_LIMIT);
      const stimulusIds = selectedGroups.flatMap((group) => group.stimulusIds);
      const claimedRows = await options.store.claimStimuli({
        tickId,
        stimulusIds,
      });
      const claimedIds = new Set(claimedRows.map((row) => row.stimulusId));

      const partiallyClaimedIds = selectedGroups.flatMap((group) => {
        const claimedInGroup = group.stimulusIds.filter((stimulusId) => claimedIds.has(stimulusId));
        return claimedInGroup.length > 0 && claimedInGroup.length !== group.stimulusIds.length
          ? claimedInGroup
          : [];
      });
      if (partiallyClaimedIds.length > 0) {
        await options.store.releaseClaimedStimuli({
          tickId,
          stimulusIds: partiallyClaimedIds,
        });
      }

      const claimedGroups = selectedGroups.filter((group) =>
        group.stimulusIds.every((stimulusId) => claimedIds.has(stimulusId)),
      );
      const items = claimedGroups.map(toBatchItem);
      const claim = {
        tickId,
        items,
        sourceKinds: [...new Set(items.map((item) => item.source))],
        claimedStimulusIds: items.flatMap((item) => item.stimulusIds),
        requiresImmediateTick: items.some((item) => item.requiresImmediateTick),
        highestPriority: items[0]?.priority ?? null,
        truncated: partiallyClaimedIds.length > 0,
        conflictMarkers: partiallyClaimedIds.length > 0 ? ['perception_partial_claim'] : [],
      } satisfies PerceptionBatch & {
        truncated: boolean;
        conflictMarkers: string[];
      };

      await options.store.attachTickPerceptionClaim({
        tickId,
        claim,
      });

      return claim;
    },
  };
}
