import { createHash } from 'node:crypto';
import type { Client } from 'pg';
import {
  CONSOLIDATION_TRANSITION_CLASS,
  CONSOLIDATION_TRANSITION_STATUS,
  GRACEFUL_SHUTDOWN_STATE,
  LIFECYCLE_EVENT_TYPE,
  LIFECYCLE_REJECTION_REASON,
  LIFECYCLE_SOURCE_OWNER,
  RETENTION_COMPACTION_MODE,
  assertValidLifecycleEventEnvelope,
  isConsolidationTransitionClass,
  isLifecycleOwnedWriteSurface,
  type ConsolidationTransitionClass,
  type ConsolidationTransitionStatus,
  type GracefulShutdownState,
  type LifecycleEventEnvelope,
  type LifecycleRejectionReason,
  type RetentionCompactionMode,
} from '@yaagi/contracts/lifecycle';
import { RUNTIME_SCHEMA, type RuntimeTickRow } from './runtime.ts';

export type LifecycleDbExecutor = Pick<Client, 'query'>;

export type LifecycleEventRow = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  sourceOwner: string;
  subjectRef: string;
  schemaVersion: string;
  idempotencyKey: string;
  payloadJson: Record<string, unknown>;
  evidenceRefsJson: string[];
  payloadHash: string;
  createdAt: string;
};

export type ConsolidationTransitionRow = {
  transitionId: string;
  transitionClass: ConsolidationTransitionClass;
  status: ConsolidationTransitionStatus;
  targetRefsJson: string[];
  sourceRefsJson: string[];
  evidenceRefsJson: string[];
  projectionJson: Record<string, unknown>;
  rejectionReason: string | null;
  lifecycleEventId: string;
  createdAt: string;
};

export type RollbackIncidentRow = {
  rollbackIncidentId: string;
  lifecycleEventId: string;
  incidentKind: string;
  severity: 'info' | 'warning' | 'critical';
  rollbackRef: string | null;
  evidenceRefsJson: string[];
  recordedAt: string;
  createdAt: string;
};

export type GracefulShutdownEventRow = {
  shutdownEventId: string;
  lifecycleEventId: string;
  shutdownState: GracefulShutdownState;
  reason: string;
  admittedInFlightWorkJson: Array<Record<string, unknown>>;
  terminalTickOutcomeJson: Record<string, unknown>;
  flushedBufferResultJson: Record<string, unknown>;
  openConcernsJson: string[];
  recordedAt: string;
  createdAt: string;
};

export type RetentionCompactionRunRow = {
  compactionRunId: string;
  lifecycleEventId: string;
  policyKind: string;
  mode: RetentionCompactionMode;
  targetRefsJson: string[];
  sourceRefsJson: string[];
  preservedRefsJson: string[];
  deletedTraceRefsJson: string[];
  subjectStateSchemaVersion: string | null;
  createdAt: string;
};

export type RecordLifecycleEventInput = LifecycleEventEnvelope;

export type RecordLifecycleEventResult =
  | {
      accepted: true;
      deduplicated: boolean;
      event: LifecycleEventRow;
    }
  | {
      accepted: false;
      reason: typeof LIFECYCLE_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
      existingEvent: LifecycleEventRow;
    };

export type RecordConsolidationTransitionInput = {
  transitionId: string;
  transitionClass: string;
  subjectRef: string;
  sourceRefs: string[];
  targetRefs: string[];
  evidenceRefs: string[];
  occurredAt: string;
  schemaVersion: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  abstractedContent?: string | null;
  provenanceAnchors?: string[];
  projection?: Record<string, unknown>;
  requestedWriteSurfaces?: string[];
};

export type RecordConsolidationTransitionResult =
  | {
      accepted: true;
      deduplicated: boolean;
      event: LifecycleEventRow;
      transition: ConsolidationTransitionRow;
    }
  | {
      accepted: false;
      reason:
        | typeof LIFECYCLE_REJECTION_REASON.UNSUPPORTED_TRANSITION_CLASS
        | typeof LIFECYCLE_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED
        | typeof LIFECYCLE_REJECTION_REASON.MISSING_PROVENANCE_ANCHOR
        | typeof LIFECYCLE_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
      event?: LifecycleEventRow;
      transition?: ConsolidationTransitionRow;
      existingEvent?: LifecycleEventRow;
    };

export type RecordRetentionCompactionInput = {
  compactionRunId: string;
  policyKind: string;
  mode: RetentionCompactionMode;
  subjectRef: string;
  sourceRefs: string[];
  targetRefs: string[];
  preservedRefs: string[];
  deletedTraceRefs: string[];
  evidenceRefs: string[];
  occurredAt: string;
  schemaVersion: string;
  idempotencyKey: string;
  subjectStateSchemaVersion?: string | null;
  dependsOnSubjectState?: boolean;
  preservePermanentBiography: boolean;
  preserveDevelopmentLedger: boolean;
  derivativeTraceRefsOnly: boolean;
  payload?: Record<string, unknown>;
};

export type RecordRetentionCompactionResult =
  | {
      accepted: true;
      deduplicated: boolean;
      event: LifecycleEventRow;
      compactionRun: RetentionCompactionRunRow;
    }
  | {
      accepted: false;
      reason:
        | typeof LIFECYCLE_REJECTION_REASON.RETENTION_POLICY_REJECTED
        | typeof LIFECYCLE_REJECTION_REASON.COMPACTION_VERSION_REF_MISSING
        | typeof LIFECYCLE_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
      existingEvent?: LifecycleEventRow;
    };

export type RecordRollbackIncidentInput = {
  rollbackIncidentId: string;
  incidentKind: string;
  severity: 'info' | 'warning' | 'critical';
  rollbackRef: string | null;
  subjectRef: string;
  evidenceRefs: string[];
  recordedAt: string;
  schemaVersion: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
};

export type RecordRollbackIncidentResult =
  | {
      accepted: true;
      deduplicated: boolean;
      event: LifecycleEventRow;
      incident: RollbackIncidentRow;
    }
  | {
      accepted: false;
      reason: typeof LIFECYCLE_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
      existingEvent: LifecycleEventRow;
    };

export type RecordGracefulShutdownInput = {
  shutdownEventId: string;
  shutdownState: GracefulShutdownState;
  reason: string;
  subjectRef: string;
  admittedInFlightWork: Array<Record<string, unknown>>;
  terminalTickOutcome: Record<string, unknown>;
  flushedBufferResult: Record<string, unknown>;
  openConcerns: string[];
  evidenceRefs: string[];
  recordedAt: string;
  schemaVersion: string;
  idempotencyKey: string;
};

export type RecordGracefulShutdownResult =
  | {
      accepted: true;
      deduplicated: boolean;
      event: LifecycleEventRow;
      shutdownEvent: GracefulShutdownEventRow;
    }
  | {
      accepted: false;
      reason: typeof LIFECYCLE_REJECTION_REASON.IDEMPOTENCY_CONFLICT;
      existingEvent: LifecycleEventRow;
    };

export type LifecycleRollbackFrequencySource = {
  metricValue: number;
  rollbackIncidentCount: number;
  gracefulShutdownEvidenceCount: number;
  evidenceRefs: string[];
};

export type LifecycleActiveWorkRef = {
  tickId: string;
  requestId: string;
  tickKind: string;
  status: string;
  startedAt: string;
  leaseExpiresAt: string;
};

export type LifecycleStore = {
  assertOwnedWriteSurface(surface: string): void;
  recordLifecycleEvent(input: RecordLifecycleEventInput): Promise<RecordLifecycleEventResult>;
  recordConsolidationTransition(
    input: RecordConsolidationTransitionInput,
  ): Promise<RecordConsolidationTransitionResult>;
  recordRetentionCompaction(
    input: RecordRetentionCompactionInput,
  ): Promise<RecordRetentionCompactionResult>;
  recordRollbackIncident(input: RecordRollbackIncidentInput): Promise<RecordRollbackIncidentResult>;
  recordGracefulShutdown(input: RecordGracefulShutdownInput): Promise<RecordGracefulShutdownResult>;
  loadRollbackFrequencySource(input: {
    since: string;
    until: string;
  }): Promise<LifecycleRollbackFrequencySource>;
  listActiveTickWork(input?: { agentId?: string }): Promise<LifecycleActiveWorkRef[]>;
};

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;
const lifecycleEventsTable = runtimeSchemaTable('lifecycle_events');
const consolidationTransitionsTable = runtimeSchemaTable('consolidation_transitions');
const rollbackIncidentsTable = runtimeSchemaTable('rollback_incidents');
const gracefulShutdownEventsTable = runtimeSchemaTable('graceful_shutdown_events');
const retentionCompactionRunsTable = runtimeSchemaTable('retention_compaction_runs');
const ticksTable = runtimeSchemaTable('ticks');

const lifecycleEventColumns = `
  event_id as "eventId",
  event_type as "eventType",
  ${asUtcIso('occurred_at', 'occurredAt')},
  source_owner as "sourceOwner",
  subject_ref as "subjectRef",
  schema_version as "schemaVersion",
  idempotency_key as "idempotencyKey",
  payload_json as "payloadJson",
  evidence_refs_json as "evidenceRefsJson",
  payload_hash as "payloadHash",
  ${asUtcIso('created_at', 'createdAt')}
`;

const consolidationTransitionColumns = `
  transition_id as "transitionId",
  transition_class as "transitionClass",
  status,
  target_refs_json as "targetRefsJson",
  source_refs_json as "sourceRefsJson",
  evidence_refs_json as "evidenceRefsJson",
  projection_json as "projectionJson",
  rejection_reason as "rejectionReason",
  lifecycle_event_id as "lifecycleEventId",
  ${asUtcIso('created_at', 'createdAt')}
`;

const rollbackIncidentColumns = `
  rollback_incident_id as "rollbackIncidentId",
  lifecycle_event_id as "lifecycleEventId",
  incident_kind as "incidentKind",
  severity,
  rollback_ref as "rollbackRef",
  evidence_refs_json as "evidenceRefsJson",
  ${asUtcIso('recorded_at', 'recordedAt')},
  ${asUtcIso('created_at', 'createdAt')}
`;

const gracefulShutdownColumns = `
  shutdown_event_id as "shutdownEventId",
  lifecycle_event_id as "lifecycleEventId",
  shutdown_state as "shutdownState",
  reason,
  admitted_in_flight_work_json as "admittedInFlightWorkJson",
  terminal_tick_outcome_json as "terminalTickOutcomeJson",
  flushed_buffer_result_json as "flushedBufferResultJson",
  open_concerns_json as "openConcernsJson",
  ${asUtcIso('recorded_at', 'recordedAt')},
  ${asUtcIso('created_at', 'createdAt')}
`;

const retentionCompactionColumns = `
  compaction_run_id as "compactionRunId",
  lifecycle_event_id as "lifecycleEventId",
  policy_kind as "policyKind",
  mode,
  target_refs_json as "targetRefsJson",
  source_refs_json as "sourceRefsJson",
  preserved_refs_json as "preservedRefsJson",
  deleted_trace_refs_json as "deletedTraceRefsJson",
  subject_state_schema_version as "subjectStateSchemaVersion",
  ${asUtcIso('created_at', 'createdAt')}
`;

function asUtcIso(column: string, alias: string): string {
  return `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;
}

const transaction = async <T>(db: LifecycleDbExecutor, run: () => Promise<T>): Promise<T> => {
  await db.query('begin');
  try {
    const result = await run();
    await db.query('commit');
    return result;
  } catch (error) {
    try {
      await db.query('rollback');
    } catch {
      // Preserve the original error.
    }
    throw error;
  }
};

const normalizeTimestamp = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`lifecycle row field ${field} must be a string or Date timestamp`);
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      entry !== null && typeof entry === 'object' && !Array.isArray(entry),
  );
};

const stableNormalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }

  if (value && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = stableNormalize((value as Record<string, unknown>)[key]);
    }
    return normalized;
  }

  return value;
};

const stableJson = (value: unknown): string => JSON.stringify(stableNormalize(value));

const hashLifecycleEvent = (input: LifecycleEventEnvelope): string =>
  createHash('sha256')
    .update(
      stableJson({
        eventType: input.eventType,
        sourceOwner: input.sourceOwner,
        subjectRef: input.subjectRef,
        schemaVersion: input.schemaVersion,
        evidenceRefs: [...input.evidenceRefs].sort(),
        payload: input.payload,
      }),
    )
    .digest('hex');

const normalizeLifecycleEventRow = (row: LifecycleEventRow): LifecycleEventRow => ({
  ...row,
  occurredAt: normalizeTimestamp(row.occurredAt, 'occurredAt'),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
  payloadJson: toRecord(row.payloadJson),
  evidenceRefsJson: toStringArray(row.evidenceRefsJson),
});

const normalizeConsolidationTransitionRow = (
  row: ConsolidationTransitionRow,
): ConsolidationTransitionRow => ({
  ...row,
  targetRefsJson: toStringArray(row.targetRefsJson),
  sourceRefsJson: toStringArray(row.sourceRefsJson),
  evidenceRefsJson: toStringArray(row.evidenceRefsJson),
  projectionJson: toRecord(row.projectionJson),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
});

const normalizeRollbackIncidentRow = (row: RollbackIncidentRow): RollbackIncidentRow => ({
  ...row,
  evidenceRefsJson: toStringArray(row.evidenceRefsJson),
  recordedAt: normalizeTimestamp(row.recordedAt, 'recordedAt'),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
});

const normalizeGracefulShutdownRow = (row: GracefulShutdownEventRow): GracefulShutdownEventRow => ({
  ...row,
  admittedInFlightWorkJson: toRecordArray(row.admittedInFlightWorkJson),
  terminalTickOutcomeJson: toRecord(row.terminalTickOutcomeJson),
  flushedBufferResultJson: toRecord(row.flushedBufferResultJson),
  openConcernsJson: toStringArray(row.openConcernsJson),
  recordedAt: normalizeTimestamp(row.recordedAt, 'recordedAt'),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
});

const normalizeRetentionCompactionRunRow = (
  row: RetentionCompactionRunRow,
): RetentionCompactionRunRow => ({
  ...row,
  targetRefsJson: toStringArray(row.targetRefsJson),
  sourceRefsJson: toStringArray(row.sourceRefsJson),
  preservedRefsJson: toStringArray(row.preservedRefsJson),
  deletedTraceRefsJson: toStringArray(row.deletedTraceRefsJson),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
});

const loadLifecycleEventByIdempotencyKey = async (
  db: LifecycleDbExecutor,
  idempotencyKey: string,
): Promise<LifecycleEventRow | null> => {
  const result = await db.query<LifecycleEventRow>(
    `select ${lifecycleEventColumns}
     from ${lifecycleEventsTable}
     where idempotency_key = $1
     limit 1`,
    [idempotencyKey],
  );

  const row = result.rows[0];
  return row ? normalizeLifecycleEventRow(row) : null;
};

const insertLifecycleEvent = async (
  db: LifecycleDbExecutor,
  input: LifecycleEventEnvelope,
  payloadHash: string,
): Promise<LifecycleEventRow | null> => {
  const result = await db.query<LifecycleEventRow>(
    `insert into ${lifecycleEventsTable} (
       event_id,
       event_type,
       occurred_at,
       source_owner,
       subject_ref,
       schema_version,
       idempotency_key,
       payload_json,
       evidence_refs_json,
       payload_hash
     )
     values ($1, $2, $3::timestamptz, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)
     on conflict (idempotency_key) do nothing
     returning ${lifecycleEventColumns}`,
    [
      input.eventId,
      input.eventType,
      input.occurredAt,
      input.sourceOwner,
      input.subjectRef,
      input.schemaVersion,
      input.idempotencyKey,
      stableJson(input.payload),
      stableJson(input.evidenceRefs),
      payloadHash,
    ],
  );

  const row = result.rows[0];
  return row ? normalizeLifecycleEventRow(row) : null;
};

const toLifecycleReplayResult = (
  existingEvent: LifecycleEventRow,
  payloadHash: string,
): RecordLifecycleEventResult => {
  if (existingEvent.payloadHash === payloadHash) {
    return {
      accepted: true,
      deduplicated: true,
      event: existingEvent,
    };
  }

  return {
    accepted: false,
    reason: LIFECYCLE_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    existingEvent,
  };
};

const recordLifecycleEventInternal = async (
  db: LifecycleDbExecutor,
  input: LifecycleEventEnvelope,
): Promise<RecordLifecycleEventResult> => {
  assertValidLifecycleEventEnvelope(input);

  const payloadHash = hashLifecycleEvent(input);
  const existingEvent = await loadLifecycleEventByIdempotencyKey(db, input.idempotencyKey);
  if (existingEvent) {
    return toLifecycleReplayResult(existingEvent, payloadHash);
  }

  const event = await insertLifecycleEvent(db, input, payloadHash);
  if (!event) {
    const racedEvent = await loadLifecycleEventByIdempotencyKey(db, input.idempotencyKey);
    if (!racedEvent) {
      throw new Error('lifecycle event insert conflict did not return or reveal an existing row');
    }

    return toLifecycleReplayResult(racedEvent, payloadHash);
  }

  return {
    accepted: true,
    deduplicated: false,
    event,
  };
};

const hasForeignWriteSurface = (surfaces: string[] | undefined): boolean =>
  (surfaces ?? []).some((surface) => !isLifecycleOwnedWriteSurface(surface));

const hasDurablePromotionProvenance = (input: RecordConsolidationTransitionInput): boolean => {
  if ((input.abstractedContent ?? '').trim().length === 0) {
    return false;
  }

  const provenanceAnchors = [...new Set(input.provenanceAnchors ?? [])].filter(
    (anchor) => anchor.trim().length > 0,
  );

  return provenanceAnchors.length >= 2;
};

const createConsolidationEventEnvelope = (input: {
  eventType:
    | typeof LIFECYCLE_EVENT_TYPE.CONSOLIDATION_TRANSITION_ACCEPTED
    | typeof LIFECYCLE_EVENT_TYPE.CONSOLIDATION_TRANSITION_REJECTED;
  transition: RecordConsolidationTransitionInput;
  transitionClass: ConsolidationTransitionClass;
  status: ConsolidationTransitionStatus;
  rejectionReason?: LifecycleRejectionReason;
}): LifecycleEventEnvelope => ({
  eventId: `lifecycle-event:${input.transition.transitionId}`,
  eventType: input.eventType,
  occurredAt: input.transition.occurredAt,
  sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
  subjectRef: input.transition.subjectRef,
  schemaVersion: input.transition.schemaVersion,
  idempotencyKey: input.transition.idempotencyKey,
  evidenceRefs: input.transition.evidenceRefs,
  payload: {
    transitionId: input.transition.transitionId,
    transitionClass: input.transitionClass,
    status: input.status,
    sourceRefs: input.transition.sourceRefs,
    targetRefs: input.transition.targetRefs,
    projection: input.transition.projection ?? {},
    payload: input.transition.payload ?? {},
    ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
  },
});

const insertConsolidationTransition = async (
  db: LifecycleDbExecutor,
  input: {
    transition: RecordConsolidationTransitionInput;
    transitionClass: ConsolidationTransitionClass;
    status: ConsolidationTransitionStatus;
    lifecycleEventId: string;
    rejectionReason: string | null;
  },
): Promise<ConsolidationTransitionRow> => {
  const result = await db.query<ConsolidationTransitionRow>(
    `insert into ${consolidationTransitionsTable} (
       transition_id,
       transition_class,
       status,
       target_refs_json,
       source_refs_json,
       evidence_refs_json,
       projection_json,
       rejection_reason,
       lifecycle_event_id
     )
     values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
     on conflict (lifecycle_event_id) do update
     set lifecycle_event_id = excluded.lifecycle_event_id
     returning ${consolidationTransitionColumns}`,
    [
      input.transition.transitionId,
      input.transitionClass,
      input.status,
      stableJson(input.transition.targetRefs),
      stableJson(input.transition.sourceRefs),
      stableJson(input.transition.evidenceRefs),
      stableJson(input.transition.projection ?? {}),
      input.rejectionReason,
      input.lifecycleEventId,
    ],
  );

  return normalizeConsolidationTransitionRow(result.rows[0] as ConsolidationTransitionRow);
};

const recordConsolidationRejection = async (
  db: LifecycleDbExecutor,
  input: RecordConsolidationTransitionInput,
  transitionClass: ConsolidationTransitionClass,
  reason: LifecycleRejectionReason,
): Promise<RecordConsolidationTransitionResult> => {
  const eventResult = await recordLifecycleEventInternal(
    db,
    createConsolidationEventEnvelope({
      eventType: LIFECYCLE_EVENT_TYPE.CONSOLIDATION_TRANSITION_REJECTED,
      transition: input,
      transitionClass,
      status: CONSOLIDATION_TRANSITION_STATUS.REJECTED,
      rejectionReason: reason,
    }),
  );

  if (!eventResult.accepted) {
    return eventResult;
  }

  const transition = await insertConsolidationTransition(db, {
    transition: input,
    transitionClass,
    status: CONSOLIDATION_TRANSITION_STATUS.REJECTED,
    lifecycleEventId: eventResult.event.eventId,
    rejectionReason: reason,
  });

  return {
    accepted: false,
    reason:
      reason === LIFECYCLE_REJECTION_REASON.MISSING_PROVENANCE_ANCHOR
        ? LIFECYCLE_REJECTION_REASON.MISSING_PROVENANCE_ANCHOR
        : LIFECYCLE_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED,
    event: eventResult.event,
    transition,
  };
};

const insertRetentionCompactionRun = async (
  db: LifecycleDbExecutor,
  input: RecordRetentionCompactionInput,
  lifecycleEventId: string,
): Promise<RetentionCompactionRunRow> => {
  const result = await db.query<RetentionCompactionRunRow>(
    `insert into ${retentionCompactionRunsTable} (
       compaction_run_id,
       lifecycle_event_id,
       policy_kind,
       mode,
       target_refs_json,
       source_refs_json,
       preserved_refs_json,
       deleted_trace_refs_json,
       subject_state_schema_version
     )
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9)
     on conflict (lifecycle_event_id) do update
     set lifecycle_event_id = excluded.lifecycle_event_id
     returning ${retentionCompactionColumns}`,
    [
      input.compactionRunId,
      lifecycleEventId,
      input.policyKind,
      input.mode,
      stableJson(input.targetRefs),
      stableJson(input.sourceRefs),
      stableJson(input.preservedRefs),
      stableJson(input.deletedTraceRefs),
      input.subjectStateSchemaVersion ?? null,
    ],
  );

  return normalizeRetentionCompactionRunRow(result.rows[0] as RetentionCompactionRunRow);
};

const insertRollbackIncident = async (
  db: LifecycleDbExecutor,
  input: RecordRollbackIncidentInput,
  lifecycleEventId: string,
): Promise<RollbackIncidentRow> => {
  const result = await db.query<RollbackIncidentRow>(
    `insert into ${rollbackIncidentsTable} (
       rollback_incident_id,
       lifecycle_event_id,
       incident_kind,
       severity,
       rollback_ref,
       evidence_refs_json,
       recorded_at
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
     on conflict (lifecycle_event_id) do update
     set lifecycle_event_id = excluded.lifecycle_event_id
     returning ${rollbackIncidentColumns}`,
    [
      input.rollbackIncidentId,
      lifecycleEventId,
      input.incidentKind,
      input.severity,
      input.rollbackRef,
      stableJson(input.evidenceRefs),
      input.recordedAt,
    ],
  );

  return normalizeRollbackIncidentRow(result.rows[0] as RollbackIncidentRow);
};

const insertGracefulShutdownEvent = async (
  db: LifecycleDbExecutor,
  input: RecordGracefulShutdownInput,
  lifecycleEventId: string,
): Promise<GracefulShutdownEventRow> => {
  const result = await db.query<GracefulShutdownEventRow>(
    `insert into ${gracefulShutdownEventsTable} (
       shutdown_event_id,
       lifecycle_event_id,
       shutdown_state,
       reason,
       admitted_in_flight_work_json,
       terminal_tick_outcome_json,
       flushed_buffer_result_json,
       open_concerns_json,
       recorded_at
     )
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::timestamptz)
     on conflict (lifecycle_event_id) do update
     set lifecycle_event_id = excluded.lifecycle_event_id
     returning ${gracefulShutdownColumns}`,
    [
      input.shutdownEventId,
      lifecycleEventId,
      input.shutdownState,
      input.reason,
      stableJson(input.admittedInFlightWork),
      stableJson(input.terminalTickOutcome),
      stableJson(input.flushedBufferResult),
      stableJson(input.openConcerns),
      input.recordedAt,
    ],
  );

  return normalizeGracefulShutdownRow(result.rows[0] as GracefulShutdownEventRow);
};

export function createLifecycleStore(db: LifecycleDbExecutor): LifecycleStore {
  return {
    assertOwnedWriteSurface(surface: string): void {
      if (!isLifecycleOwnedWriteSurface(surface)) {
        throw new Error(`${LIFECYCLE_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED}: ${surface}`);
      }
    },

    recordLifecycleEvent(input: RecordLifecycleEventInput): Promise<RecordLifecycleEventResult> {
      return transaction(db, () => recordLifecycleEventInternal(db, input));
    },

    recordConsolidationTransition(
      input: RecordConsolidationTransitionInput,
    ): Promise<RecordConsolidationTransitionResult> {
      return transaction(db, async () => {
        if (!isConsolidationTransitionClass(input.transitionClass)) {
          return {
            accepted: false,
            reason: LIFECYCLE_REJECTION_REASON.UNSUPPORTED_TRANSITION_CLASS,
          };
        }

        if (hasForeignWriteSurface(input.requestedWriteSurfaces)) {
          return await recordConsolidationRejection(
            db,
            input,
            input.transitionClass,
            LIFECYCLE_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED,
          );
        }

        if (
          input.transitionClass === CONSOLIDATION_TRANSITION_CLASS.PROMOTE_MEMETIC_UNIT &&
          !hasDurablePromotionProvenance(input)
        ) {
          return await recordConsolidationRejection(
            db,
            input,
            input.transitionClass,
            LIFECYCLE_REJECTION_REASON.MISSING_PROVENANCE_ANCHOR,
          );
        }

        const eventResult = await recordLifecycleEventInternal(
          db,
          createConsolidationEventEnvelope({
            eventType: LIFECYCLE_EVENT_TYPE.CONSOLIDATION_TRANSITION_ACCEPTED,
            transition: input,
            transitionClass: input.transitionClass,
            status: CONSOLIDATION_TRANSITION_STATUS.ACCEPTED,
          }),
        );

        if (!eventResult.accepted) {
          return eventResult;
        }

        const transition = await insertConsolidationTransition(db, {
          transition: input,
          transitionClass: input.transitionClass,
          status: CONSOLIDATION_TRANSITION_STATUS.ACCEPTED,
          lifecycleEventId: eventResult.event.eventId,
          rejectionReason: null,
        });

        return {
          accepted: true,
          deduplicated: eventResult.deduplicated,
          event: eventResult.event,
          transition,
        };
      });
    },

    recordRetentionCompaction(
      input: RecordRetentionCompactionInput,
    ): Promise<RecordRetentionCompactionResult> {
      return transaction(db, async () => {
        if (
          !input.preservePermanentBiography ||
          !input.preserveDevelopmentLedger ||
          !input.derivativeTraceRefsOnly
        ) {
          return {
            accepted: false,
            reason: LIFECYCLE_REJECTION_REASON.RETENTION_POLICY_REJECTED,
          };
        }

        if (input.dependsOnSubjectState && !input.subjectStateSchemaVersion) {
          return {
            accepted: false,
            reason: LIFECYCLE_REJECTION_REASON.COMPACTION_VERSION_REF_MISSING,
          };
        }

        const eventResult = await recordLifecycleEventInternal(db, {
          eventId: `lifecycle-event:${input.compactionRunId}`,
          eventType: LIFECYCLE_EVENT_TYPE.RETENTION_COMPACTION_COMPLETED,
          occurredAt: input.occurredAt,
          sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
          subjectRef: input.subjectRef,
          schemaVersion: input.schemaVersion,
          idempotencyKey: input.idempotencyKey,
          evidenceRefs: input.evidenceRefs,
          payload: {
            compactionRunId: input.compactionRunId,
            policyKind: input.policyKind,
            mode: input.mode,
            sourceRefs: input.sourceRefs,
            targetRefs: input.targetRefs,
            preservedRefs: input.preservedRefs,
            deletedTraceRefs: input.deletedTraceRefs,
            subjectStateSchemaVersion: input.subjectStateSchemaVersion ?? null,
            payload: input.payload ?? {},
          },
        });

        if (!eventResult.accepted) {
          return eventResult;
        }

        const compactionRun = await insertRetentionCompactionRun(
          db,
          input,
          eventResult.event.eventId,
        );

        return {
          accepted: true,
          deduplicated: eventResult.deduplicated,
          event: eventResult.event,
          compactionRun,
        };
      });
    },

    recordRollbackIncident(
      input: RecordRollbackIncidentInput,
    ): Promise<RecordRollbackIncidentResult> {
      return transaction(db, async () => {
        const eventResult = await recordLifecycleEventInternal(db, {
          eventId: `lifecycle-event:${input.rollbackIncidentId}`,
          eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
          occurredAt: input.recordedAt,
          sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
          subjectRef: input.subjectRef,
          schemaVersion: input.schemaVersion,
          idempotencyKey: input.idempotencyKey,
          evidenceRefs: input.evidenceRefs,
          payload: {
            rollbackIncidentId: input.rollbackIncidentId,
            incidentKind: input.incidentKind,
            severity: input.severity,
            rollbackRef: input.rollbackRef,
            payload: input.payload ?? {},
          },
        });

        if (!eventResult.accepted) {
          return eventResult;
        }

        const incident = await insertRollbackIncident(db, input, eventResult.event.eventId);
        return {
          accepted: true,
          deduplicated: eventResult.deduplicated,
          event: eventResult.event,
          incident,
        };
      });
    },

    recordGracefulShutdown(
      input: RecordGracefulShutdownInput,
    ): Promise<RecordGracefulShutdownResult> {
      return transaction(db, async () => {
        const eventResult = await recordLifecycleEventInternal(db, {
          eventId: `lifecycle-event:${input.shutdownEventId}`,
          eventType:
            input.shutdownState === GRACEFUL_SHUTDOWN_STATE.SHUTTING_DOWN
              ? LIFECYCLE_EVENT_TYPE.SHUTDOWN_REQUESTED
              : LIFECYCLE_EVENT_TYPE.SHUTDOWN_COMPLETED,
          occurredAt: input.recordedAt,
          sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
          subjectRef: input.subjectRef,
          schemaVersion: input.schemaVersion,
          idempotencyKey: input.idempotencyKey,
          evidenceRefs: input.evidenceRefs,
          payload: {
            shutdownEventId: input.shutdownEventId,
            shutdownState: input.shutdownState,
            reason: input.reason,
            admittedInFlightWork: input.admittedInFlightWork,
            terminalTickOutcome: input.terminalTickOutcome,
            flushedBufferResult: input.flushedBufferResult,
            openConcerns: input.openConcerns,
          },
        });

        if (!eventResult.accepted) {
          return eventResult;
        }

        const shutdownEvent = await insertGracefulShutdownEvent(
          db,
          input,
          eventResult.event.eventId,
        );

        return {
          accepted: true,
          deduplicated: eventResult.deduplicated,
          event: eventResult.event,
          shutdownEvent,
        };
      });
    },

    async loadRollbackFrequencySource(input: {
      since: string;
      until: string;
    }): Promise<LifecycleRollbackFrequencySource> {
      const result = await db.query<{
        rollbackIncidentCount: string;
        gracefulShutdownEvidenceCount: string;
        rollbackRefs: unknown;
        shutdownRefs: unknown;
      }>(
        `select
           (
             select count(*)::text
             from ${rollbackIncidentsTable}
             where recorded_at >= $1::timestamptz
               and recorded_at <= $2::timestamptz
           ) as "rollbackIncidentCount",
           (
             select count(*)::text
             from ${gracefulShutdownEventsTable}
             where recorded_at >= $1::timestamptz
               and recorded_at <= $2::timestamptz
           ) as "gracefulShutdownEvidenceCount",
           coalesce((
             select jsonb_agg('rollback_incident:' || rollback_incident_id order by recorded_at desc)
             from ${rollbackIncidentsTable}
             where recorded_at >= $1::timestamptz
               and recorded_at <= $2::timestamptz
           ), '[]'::jsonb) as "rollbackRefs",
           coalesce((
             select jsonb_agg('graceful_shutdown:' || shutdown_event_id order by recorded_at desc)
             from ${gracefulShutdownEventsTable}
             where recorded_at >= $1::timestamptz
               and recorded_at <= $2::timestamptz
           ), '[]'::jsonb) as "shutdownRefs"`,
        [input.since, input.until],
      );

      const row = result.rows[0];
      const rollbackIncidentCount = Number(row?.rollbackIncidentCount ?? 0);
      const gracefulShutdownEvidenceCount = Number(row?.gracefulShutdownEvidenceCount ?? 0);

      return {
        metricValue: rollbackIncidentCount,
        rollbackIncidentCount,
        gracefulShutdownEvidenceCount,
        evidenceRefs: [...toStringArray(row?.rollbackRefs), ...toStringArray(row?.shutdownRefs)],
      };
    },

    async listActiveTickWork(input: { agentId?: string } = {}): Promise<LifecycleActiveWorkRef[]> {
      const result = await db.query<
        Pick<
          RuntimeTickRow,
          'tickId' | 'requestId' | 'tickKind' | 'status' | 'startedAt' | 'leaseExpiresAt'
        >
      >(
        `select
           tick_id as "tickId",
           request_id as "requestId",
           tick_kind as "tickKind",
           status,
           ${asUtcIso('started_at', 'startedAt')},
           ${asUtcIso('lease_expires_at', 'leaseExpiresAt')}
         from ${ticksTable}
         where status = 'started'
           and ended_at is null
           and ($1::text is null or agent_id = $1)
         order by started_at asc, tick_id asc`,
        [input.agentId ?? null],
      );

      return result.rows.map((row) => ({
        tickId: row.tickId,
        requestId: row.requestId,
        tickKind: row.tickKind,
        status: row.status,
        startedAt: normalizeTimestamp(row.startedAt, 'startedAt'),
        leaseExpiresAt: normalizeTimestamp(row.leaseExpiresAt, 'leaseExpiresAt'),
      }));
    },
  };
}

export { RETENTION_COMPACTION_MODE };
