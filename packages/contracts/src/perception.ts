import { z } from 'zod';

export const SENSOR_SOURCE = Object.freeze({
  HTTP: 'http',
  FILE: 'file',
  TELEGRAM: 'telegram',
  SCHEDULER: 'scheduler',
  RESOURCE: 'resource',
  SYSTEM: 'system',
} as const);

export type SensorSource = (typeof SENSOR_SOURCE)[keyof typeof SENSOR_SOURCE];

export const STIMULUS_PRIORITY = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const);

export type StimulusPriority = (typeof STIMULUS_PRIORITY)[keyof typeof STIMULUS_PRIORITY];

export const STIMULUS_STATUS = Object.freeze({
  QUEUED: 'queued',
  CLAIMED: 'claimed',
  CONSUMED: 'consumed',
  DROPPED: 'dropped',
} as const);

export type StimulusStatus = (typeof STIMULUS_STATUS)[keyof typeof STIMULUS_STATUS];

export const ADAPTER_HEALTH_STATUS = Object.freeze({
  DISABLED: 'disabled',
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  FAILED: 'failed',
} as const);

export type AdapterHealthStatus =
  (typeof ADAPTER_HEALTH_STATUS)[keyof typeof ADAPTER_HEALTH_STATUS];

const isoTimestampSchema = z.string().datetime({ offset: true });
const jsonRecordSchema = z.record(z.unknown());

export const sensorSourceSchema = z.enum([
  SENSOR_SOURCE.HTTP,
  SENSOR_SOURCE.FILE,
  SENSOR_SOURCE.TELEGRAM,
  SENSOR_SOURCE.SCHEDULER,
  SENSOR_SOURCE.RESOURCE,
  SENSOR_SOURCE.SYSTEM,
]);

export const stimulusPrioritySchema = z.enum([
  STIMULUS_PRIORITY.LOW,
  STIMULUS_PRIORITY.NORMAL,
  STIMULUS_PRIORITY.HIGH,
  STIMULUS_PRIORITY.CRITICAL,
]);

export const stimulusStatusSchema = z.enum([
  STIMULUS_STATUS.QUEUED,
  STIMULUS_STATUS.CLAIMED,
  STIMULUS_STATUS.CONSUMED,
  STIMULUS_STATUS.DROPPED,
]);

export const adapterHealthStatusSchema = z.enum([
  ADAPTER_HEALTH_STATUS.DISABLED,
  ADAPTER_HEALTH_STATUS.HEALTHY,
  ADAPTER_HEALTH_STATUS.DEGRADED,
  ADAPTER_HEALTH_STATUS.FAILED,
]);

export const sensorSignalSchema = z.object({
  source: sensorSourceSchema,
  signalType: z.string().min(1),
  occurredAt: isoTimestampSchema.optional(),
  priority: stimulusPrioritySchema.optional(),
  threadId: z.string().min(1).optional(),
  entityRefs: z.array(z.string().min(1)).optional(),
  requiresImmediateTick: z.boolean().optional(),
  reliability: z.number().min(0).max(1).optional(),
  payload: jsonRecordSchema.default({}),
  dedupeKey: z.string().min(1).optional(),
  aggregateHints: jsonRecordSchema.optional(),
});

export type SensorSignal = z.infer<typeof sensorSignalSchema>;

export const httpIngestStimulusSchema = z.object({
  signalType: z.string().min(1),
  occurredAt: isoTimestampSchema.optional(),
  priority: stimulusPrioritySchema.optional(),
  threadId: z.string().min(1).optional(),
  entityRefs: z.array(z.string().min(1)).optional(),
  requiresImmediateTick: z.boolean().optional(),
  reliability: z.number().min(0).max(1).optional(),
  payload: jsonRecordSchema.default({}),
  dedupeKey: z.string().min(1).optional(),
  aggregateHints: jsonRecordSchema.optional(),
});

export type HttpIngestStimulusInput = z.infer<typeof httpIngestStimulusSchema>;

export const stimulusEnvelopeSchema = z.object({
  id: z.string().min(1),
  source: sensorSourceSchema,
  occurredAt: isoTimestampSchema,
  priority: stimulusPrioritySchema,
  threadId: z.string().min(1).nullable().optional(),
  entityRefs: z.array(z.string().min(1)),
  requiresImmediateTick: z.boolean(),
  payload: jsonRecordSchema,
  reliability: z.number().min(0).max(1),
});

export type StimulusEnvelope = z.infer<typeof stimulusEnvelopeSchema>;

export const normalizedStimulusSchema = z.object({
  envelope: stimulusEnvelopeSchema,
  signalType: z.string().min(1),
  dedupeKey: z.string().min(1).nullable().optional(),
  aggregateHints: jsonRecordSchema.default({}),
});

export type NormalizedStimulus = z.infer<typeof normalizedStimulusSchema>;

export const stimulusInboxRecordSchema = z.object({
  stimulusId: z.string().min(1),
  sourceKind: sensorSourceSchema,
  threadId: z.string().min(1).nullable(),
  occurredAt: isoTimestampSchema,
  priority: stimulusPrioritySchema,
  priorityRank: z.number().int(),
  requiresImmediateTick: z.boolean(),
  payloadJson: jsonRecordSchema,
  normalizedJson: normalizedStimulusSchema,
  dedupeKey: z.string().min(1).nullable(),
  claimTickId: z.string().min(1).nullable(),
  status: stimulusStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export type StimulusInboxRecord = z.infer<typeof stimulusInboxRecordSchema>;

export const enqueueStimulusInputSchema = z.object({
  envelope: stimulusEnvelopeSchema,
  signalType: z.string().min(1),
  dedupeKey: z.string().min(1).nullable().optional(),
  aggregateHints: jsonRecordSchema.optional(),
});

export type EnqueueStimulusInput = z.infer<typeof enqueueStimulusInputSchema>;

export type AdapterHealthSnapshot = {
  source: SensorSource;
  status: AdapterHealthStatus;
  detail?: string;
  lastSignalAt?: string | null;
};

export type PerceptionBacklogCounts = {
  queued: number;
  claimed: number;
  consumed: number;
  dropped: number;
};

export type PerceptionHealthSnapshot = {
  adapters: AdapterHealthSnapshot[];
  backlog: PerceptionBacklogCounts;
};

export type PerceptionBatchItem = {
  stimulusIds: string[];
  primaryStimulusId: string;
  source: SensorSource;
  signalType: string;
  occurredAt: string;
  priority: StimulusPriority;
  requiresImmediateTick: boolean;
  threadId: string | null;
  entityRefs: string[];
  payload: Record<string, unknown>;
  dedupeKey: string | null;
  coalescedCount: number;
};

export type PerceptionBatch = {
  tickId: string;
  items: PerceptionBatchItem[];
  sourceKinds: SensorSource[];
  claimedStimulusIds: string[];
  requiresImmediateTick: boolean;
  highestPriority: StimulusPriority | null;
};

export type TickPerceptionClaim = PerceptionBatch;

export const DEFAULT_PERCEPTION_BACKLOG_COUNTS: PerceptionBacklogCounts = Object.freeze({
  queued: 0,
  claimed: 0,
  consumed: 0,
  dropped: 0,
});

export const DEFAULT_PERCEPTION_HEALTH: PerceptionHealthSnapshot = Object.freeze({
  adapters: [
    { source: SENSOR_SOURCE.HTTP, status: ADAPTER_HEALTH_STATUS.HEALTHY },
    { source: SENSOR_SOURCE.FILE, status: ADAPTER_HEALTH_STATUS.DISABLED },
    { source: SENSOR_SOURCE.TELEGRAM, status: ADAPTER_HEALTH_STATUS.DISABLED },
    { source: SENSOR_SOURCE.SCHEDULER, status: ADAPTER_HEALTH_STATUS.DISABLED },
    { source: SENSOR_SOURCE.RESOURCE, status: ADAPTER_HEALTH_STATUS.DISABLED },
    { source: SENSOR_SOURCE.SYSTEM, status: ADAPTER_HEALTH_STATUS.DISABLED },
  ],
  backlog: DEFAULT_PERCEPTION_BACKLOG_COUNTS,
});

const PRIORITY_RANK: Record<StimulusPriority, number> = {
  [STIMULUS_PRIORITY.LOW]: 0,
  [STIMULUS_PRIORITY.NORMAL]: 1,
  [STIMULUS_PRIORITY.HIGH]: 2,
  [STIMULUS_PRIORITY.CRITICAL]: 3,
};

export const getStimulusPriorityRank = (priority: StimulusPriority): number =>
  PRIORITY_RANK[priority];

export const buildStimulusEnvelope = (input: {
  id: string;
  source: SensorSource;
  occurredAt: string;
  priority?: StimulusPriority;
  threadId?: string | null;
  entityRefs?: string[];
  requiresImmediateTick?: boolean;
  payload?: Record<string, unknown>;
  reliability?: number;
}): StimulusEnvelope =>
  stimulusEnvelopeSchema.parse({
    id: input.id,
    source: input.source,
    occurredAt: input.occurredAt,
    priority: input.priority ?? STIMULUS_PRIORITY.NORMAL,
    threadId: input.threadId ?? null,
    entityRefs: input.entityRefs ?? [],
    requiresImmediateTick: input.requiresImmediateTick ?? false,
    payload: input.payload ?? {},
    reliability: input.reliability ?? 1,
  });
