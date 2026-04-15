import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSOLIDATION_TRANSITION_CLASS,
  LIFECYCLE_EVENT_TYPE,
  LIFECYCLE_FOREIGN_WRITE_SURFACE,
  LIFECYCLE_REJECTION_REASON,
  LIFECYCLE_SOURCE_OWNER,
  RETENTION_COMPACTION_MODE,
} from '@yaagi/contracts/lifecycle';
import {
  createLifecycleStore,
  type ConsolidationTransitionRow,
  type GracefulShutdownEventRow,
  type LifecycleDbExecutor,
  type LifecycleEventRow,
  type RetentionCompactionRunRow,
  type RollbackIncidentRow,
} from '../src/lifecycle.ts';

type Harness = {
  db: LifecycleDbExecutor;
  events: LifecycleEventRow[];
  transitions: ConsolidationTransitionRow[];
  incidents: RollbackIncidentRow[];
  shutdowns: GracefulShutdownEventRow[];
  compactions: RetentionCompactionRunRow[];
  activeTicks: Array<{
    tickId: string;
    requestId: string;
    tickKind: string;
    status: string;
    startedAt: string;
    leaseExpiresAt: string;
  }>;
};

type HarnessOptions = {
  beforeLifecycleEventInsert?: () => Promise<void>;
};

const parseJson = <T>(value: unknown): T => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
};

const inWindow = (value: string, since: string, until: string): boolean => {
  const time = Date.parse(value);
  return time >= Date.parse(since) && time <= Date.parse(until);
};

const createHarness = (options: HarnessOptions = {}): Harness => {
  const events: LifecycleEventRow[] = [];
  const transitions: ConsolidationTransitionRow[] = [];
  const incidents: RollbackIncidentRow[] = [];
  const shutdowns: GracefulShutdownEventRow[] = [];
  const compactions: RetentionCompactionRunRow[] = [];
  const activeTicks: Harness['activeTicks'] = [];

  const query = (async (sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('lifecycle db harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return Promise.resolve({ rows: [] });
    }

    if (
      sql.includes('from polyphony_runtime.lifecycle_events') &&
      sql.includes('where idempotency_key')
    ) {
      const event = events.find((row) => row.idempotencyKey === params[0]);
      return Promise.resolve({ rows: event ? [event] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.lifecycle_events')) {
      await options.beforeLifecycleEventInsert?.();
      const existing = events.find((row) => row.idempotencyKey === params[6]);
      if (existing) {
        return { rows: [] };
      }

      const row: LifecycleEventRow = {
        eventId: params[0] as string,
        eventType: params[1] as string,
        occurredAt: params[2] as string,
        sourceOwner: params[3] as string,
        subjectRef: params[4] as string,
        schemaVersion: params[5] as string,
        idempotencyKey: params[6] as string,
        payloadJson: parseJson<Record<string, unknown>>(params[7]),
        evidenceRefsJson: parseJson<string[]>(params[8]),
        payloadHash: params[9] as string,
        createdAt: params[2] as string,
      };
      events.push(row);
      return { rows: [row] };
    }

    if (sql.startsWith('insert into polyphony_runtime.consolidation_transitions')) {
      const lifecycleEventId = params[8] as string;
      const existing = transitions.find((row) => row.lifecycleEventId === lifecycleEventId);
      if (existing) {
        return Promise.resolve({ rows: [existing] });
      }

      const row: ConsolidationTransitionRow = {
        transitionId: params[0] as string,
        transitionClass: params[1] as ConsolidationTransitionRow['transitionClass'],
        status: params[2] as ConsolidationTransitionRow['status'],
        targetRefsJson: parseJson<string[]>(params[3]),
        sourceRefsJson: parseJson<string[]>(params[4]),
        evidenceRefsJson: parseJson<string[]>(params[5]),
        projectionJson: parseJson<Record<string, unknown>>(params[6]),
        rejectionReason: (params[7] as string | null) ?? null,
        lifecycleEventId,
        createdAt: '2026-04-15T12:00:00.000Z',
      };
      transitions.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('insert into polyphony_runtime.retention_compaction_runs')) {
      const lifecycleEventId = params[1] as string;
      const existing = compactions.find((row) => row.lifecycleEventId === lifecycleEventId);
      if (existing) {
        return Promise.resolve({ rows: [existing] });
      }

      const row: RetentionCompactionRunRow = {
        compactionRunId: params[0] as string,
        lifecycleEventId,
        policyKind: params[2] as string,
        mode: params[3] as RetentionCompactionRunRow['mode'],
        targetRefsJson: parseJson<string[]>(params[4]),
        sourceRefsJson: parseJson<string[]>(params[5]),
        preservedRefsJson: parseJson<string[]>(params[6]),
        deletedTraceRefsJson: parseJson<string[]>(params[7]),
        subjectStateSchemaVersion: (params[8] as string | null) ?? null,
        createdAt: '2026-04-15T12:00:00.000Z',
      };
      compactions.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('insert into polyphony_runtime.rollback_incidents')) {
      const lifecycleEventId = params[1] as string;
      const existing = incidents.find((row) => row.lifecycleEventId === lifecycleEventId);
      if (existing) {
        return Promise.resolve({ rows: [existing] });
      }

      const row: RollbackIncidentRow = {
        rollbackIncidentId: params[0] as string,
        lifecycleEventId,
        incidentKind: params[2] as string,
        severity: params[3] as RollbackIncidentRow['severity'],
        rollbackRef: (params[4] as string | null) ?? null,
        evidenceRefsJson: parseJson<string[]>(params[5]),
        recordedAt: params[6] as string,
        createdAt: params[6] as string,
      };
      incidents.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('insert into polyphony_runtime.graceful_shutdown_events')) {
      const lifecycleEventId = params[1] as string;
      const existing = shutdowns.find((row) => row.lifecycleEventId === lifecycleEventId);
      if (existing) {
        return Promise.resolve({ rows: [existing] });
      }

      const row: GracefulShutdownEventRow = {
        shutdownEventId: params[0] as string,
        lifecycleEventId,
        shutdownState: params[2] as GracefulShutdownEventRow['shutdownState'],
        reason: params[3] as string,
        admittedInFlightWorkJson: parseJson<Array<Record<string, unknown>>>(params[4]),
        terminalTickOutcomeJson: parseJson<Record<string, unknown>>(params[5]),
        flushedBufferResultJson: parseJson<Record<string, unknown>>(params[6]),
        openConcernsJson: parseJson<string[]>(params[7]),
        recordedAt: params[8] as string,
        createdAt: params[8] as string,
      };
      shutdowns.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.includes('rollbackincidentcount')) {
      const since = params[0] as string;
      const until = params[1] as string;
      const matchingIncidents = incidents.filter((row) => inWindow(row.recordedAt, since, until));
      const matchingShutdowns = shutdowns.filter((row) => inWindow(row.recordedAt, since, until));
      return Promise.resolve({
        rows: [
          {
            rollbackIncidentCount: String(matchingIncidents.length),
            gracefulShutdownEvidenceCount: String(matchingShutdowns.length),
            rollbackRefs: matchingIncidents.map(
              (row) => `rollback_incident:${row.rollbackIncidentId}`,
            ),
            shutdownRefs: matchingShutdowns.map(
              (row) => `graceful_shutdown:${row.shutdownEventId}`,
            ),
          },
        ],
      });
    }

    if (sql.includes('from polyphony_runtime.ticks') && sql.includes("where status = 'started'")) {
      return Promise.resolve({ rows: activeTicks });
    }

    throw new Error(`unsupported sql in lifecycle db harness: ${sqlText}`);
  }) as LifecycleDbExecutor['query'];

  return {
    db: { query } as LifecycleDbExecutor,
    events,
    transitions,
    incidents,
    shutdowns,
    compactions,
    activeTicks,
  };
};

void test('AC-F0019-03 AC-F0019-04 AC-F0019-05 AC-F0019-06 records lifecycle envelopes with replay-safe idempotency', async () => {
  const harness = createHarness();
  const store = createLifecycleStore(harness.db);

  const first = await store.recordLifecycleEvent({
    eventId: 'event-rollback-1',
    eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
    occurredAt: '2026-04-15T12:00:00.000Z',
    sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
    subjectRef: 'runtime:polyphony-core',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'rollback:1',
    evidenceRefs: ['tick:tick-1'],
    payload: { b: 2, a: 1 },
  });
  const replay = await store.recordLifecycleEvent({
    eventId: 'event-rollback-replay',
    eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
    occurredAt: '2026-04-15T12:01:00.000Z',
    sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
    subjectRef: 'runtime:polyphony-core',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'rollback:1',
    evidenceRefs: ['tick:tick-1'],
    payload: { a: 1, b: 2 },
  });
  const conflict = await store.recordLifecycleEvent({
    eventId: 'event-rollback-conflict',
    eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
    occurredAt: '2026-04-15T12:02:00.000Z',
    sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
    subjectRef: 'runtime:polyphony-core',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'rollback:1',
    evidenceRefs: ['tick:tick-1'],
    payload: { a: 9 },
  });

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(replay.deduplicated, true);
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, LIFECYCLE_REJECTION_REASON.IDEMPOTENCY_CONFLICT);
  assert.equal(harness.events.length, 1);
});

void test('AC-F0019-05 AC-F0019-06 keeps lifecycle idempotency deterministic across concurrent replays', async () => {
  let insertAttempts = 0;
  let releaseInserts: (() => void) | null = null;
  const insertsReleased = new Promise<void>((resolve) => {
    releaseInserts = resolve;
  });
  const harness = createHarness({
    beforeLifecycleEventInsert: async () => {
      insertAttempts += 1;
      if (insertAttempts === 2) {
        releaseInserts?.();
      }
      await insertsReleased;
    },
  });
  const store = createLifecycleStore(harness.db);

  const [first, second] = await Promise.all([
    store.recordLifecycleEvent({
      eventId: 'event-concurrent-1',
      eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
      occurredAt: '2026-04-15T12:00:00.000Z',
      sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
      subjectRef: 'runtime:polyphony-core',
      schemaVersion: '018_lifecycle_consolidation.sql',
      idempotencyKey: 'rollback:concurrent',
      evidenceRefs: ['tick:tick-1'],
      payload: { a: 1, b: 2 },
    }),
    store.recordLifecycleEvent({
      eventId: 'event-concurrent-2',
      eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
      occurredAt: '2026-04-15T12:00:01.000Z',
      sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
      subjectRef: 'runtime:polyphony-core',
      schemaVersion: '018_lifecycle_consolidation.sql',
      idempotencyKey: 'rollback:concurrent',
      evidenceRefs: ['tick:tick-1'],
      payload: { b: 2, a: 1 },
    }),
  ]);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.deepEqual([first.deduplicated, second.deduplicated].sort(), [false, true]);
  assert.equal(first.event.eventId, second.event.eventId);
  assert.equal(harness.events.length, 1);

  insertAttempts = 0;
  releaseInserts = null;
  const conflictReleased = new Promise<void>((resolve) => {
    releaseInserts = resolve;
  });
  const conflictHarness = createHarness({
    beforeLifecycleEventInsert: async () => {
      insertAttempts += 1;
      if (insertAttempts === 2) {
        releaseInserts?.();
      }
      await conflictReleased;
    },
  });
  const conflictStore = createLifecycleStore(conflictHarness.db);

  const conflictResults = await Promise.all([
    conflictStore.recordLifecycleEvent({
      eventId: 'event-concurrent-conflict-1',
      eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
      occurredAt: '2026-04-15T12:00:00.000Z',
      sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
      subjectRef: 'runtime:polyphony-core',
      schemaVersion: '018_lifecycle_consolidation.sql',
      idempotencyKey: 'rollback:concurrent-conflict',
      evidenceRefs: ['tick:tick-1'],
      payload: { a: 1 },
    }),
    conflictStore.recordLifecycleEvent({
      eventId: 'event-concurrent-conflict-2',
      eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
      occurredAt: '2026-04-15T12:00:01.000Z',
      sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
      subjectRef: 'runtime:polyphony-core',
      schemaVersion: '018_lifecycle_consolidation.sql',
      idempotencyKey: 'rollback:concurrent-conflict',
      evidenceRefs: ['tick:tick-1'],
      payload: { a: 2 },
    }),
  ]);

  assert.equal(conflictResults.filter((result) => result.accepted).length, 1);
  assert.equal(
    conflictResults.filter(
      (result) =>
        !result.accepted && result.reason === LIFECYCLE_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
    ).length,
    1,
  );
  assert.equal(conflictHarness.events.length, 1);
});

void test('AC-F0019-01 AC-F0019-02 AC-F0019-07 AC-F0019-08 AC-F0019-09 AC-F0019-18 enforces transition boundary guards', async () => {
  const harness = createHarness();
  const store = createLifecycleStore(harness.db);

  const unsupported = await store.recordConsolidationTransition({
    transitionId: 'transition-unsupported',
    transitionClass: 'rewrite_subject_state',
    subjectRef: 'memetic:unit-1',
    sourceRefs: ['unit:unit-1'],
    targetRefs: ['unit:unit-2'],
    evidenceRefs: ['tick:tick-1'],
    occurredAt: '2026-04-15T12:00:00.000Z',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'transition:unsupported',
  });
  assert.equal(unsupported.accepted, false);
  assert.equal(unsupported.reason, LIFECYCLE_REJECTION_REASON.UNSUPPORTED_TRANSITION_CLASS);
  assert.equal(harness.events.length, 0);

  const foreignWrite = await store.recordConsolidationTransition({
    transitionId: 'transition-foreign',
    transitionClass: CONSOLIDATION_TRANSITION_CLASS.RETIRE_MEMETIC_UNIT,
    subjectRef: 'memetic:unit-1',
    sourceRefs: ['unit:unit-1'],
    targetRefs: ['unit:unit-1'],
    evidenceRefs: ['tick:tick-1'],
    occurredAt: '2026-04-15T12:05:00.000Z',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'transition:foreign',
    requestedWriteSurfaces: [LIFECYCLE_FOREIGN_WRITE_SURFACE.TICKS],
  });
  assert.equal(foreignWrite.accepted, false);
  assert.equal(foreignWrite.reason, LIFECYCLE_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED);

  const missingProvenance = await store.recordConsolidationTransition({
    transitionId: 'transition-promotion-rejected',
    transitionClass: CONSOLIDATION_TRANSITION_CLASS.PROMOTE_MEMETIC_UNIT,
    subjectRef: 'memetic:unit-1',
    sourceRefs: ['stimulus:one'],
    targetRefs: ['unit:unit-1'],
    evidenceRefs: ['stimulus:one'],
    occurredAt: '2026-04-15T12:06:00.000Z',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'transition:promotion-rejected',
    abstractedContent: 'resource pressure',
    provenanceAnchors: ['stimulus:one'],
  });
  assert.equal(missingProvenance.accepted, false);
  assert.equal(missingProvenance.reason, LIFECYCLE_REJECTION_REASON.MISSING_PROVENANCE_ANCHOR);
  assert.equal(missingProvenance.transition?.status, 'rejected');

  const acceptedProjection = await store.recordConsolidationTransition({
    transitionId: 'transition-dataset',
    transitionClass: CONSOLIDATION_TRANSITION_CLASS.PREPARE_DATASET_CANDIDATE,
    subjectRef: 'dataset-candidate:candidate-1',
    sourceRefs: ['lifecycle:event-1'],
    targetRefs: ['dataset-candidate:candidate-1'],
    evidenceRefs: ['lifecycle:event-1'],
    occurredAt: '2026-04-15T12:07:00.000Z',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'transition:dataset',
    projection: {
      projectionKind: 'dataset_candidate',
      sourceLifecycleRefs: ['lifecycle:event-1'],
      bounded: true,
    },
  });

  assert.equal(acceptedProjection.accepted, true);
  assert.equal(acceptedProjection.transition.transitionClass, 'prepare_dataset_candidate');
  assert.equal(acceptedProjection.transition.projectionJson['bounded'], true);
});

void test('AC-F0019-10 AC-F0019-11 AC-F0019-12 enforces retention and compaction policy guards', async () => {
  const harness = createHarness();
  const store = createLifecycleStore(harness.db);

  const rejectsBiographyDeletion = await store.recordRetentionCompaction({
    compactionRunId: 'compaction-danger',
    policyKind: 'field_journal_compaction',
    mode: RETENTION_COMPACTION_MODE.AGGREGATE_ONLY,
    subjectRef: 'journal:window-1',
    sourceRefs: ['journal:entry-1'],
    targetRefs: ['journal:summary-1'],
    preservedRefs: ['episode:permanent-1'],
    deletedTraceRefs: ['episode:permanent-1'],
    evidenceRefs: ['policy:retention-1'],
    occurredAt: '2026-04-15T12:10:00.000Z',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'compaction:danger',
    preservePermanentBiography: false,
    preserveDevelopmentLedger: true,
    derivativeTraceRefsOnly: false,
  });
  assert.equal(rejectsBiographyDeletion.accepted, false);
  assert.equal(
    rejectsBiographyDeletion.reason,
    LIFECYCLE_REJECTION_REASON.RETENTION_POLICY_REJECTED,
  );

  const rejectsMissingVersion = await store.recordRetentionCompaction({
    compactionRunId: 'compaction-missing-version',
    policyKind: 'field_journal_compaction',
    mode: RETENTION_COMPACTION_MODE.AGGREGATE_ONLY,
    subjectRef: 'journal:window-2',
    sourceRefs: ['subject-state:snapshot-1'],
    targetRefs: ['journal:summary-2'],
    preservedRefs: ['subject-state:snapshot-1'],
    deletedTraceRefs: ['trace:derived-1'],
    evidenceRefs: ['policy:retention-1'],
    occurredAt: '2026-04-15T12:11:00.000Z',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'compaction:missing-version',
    dependsOnSubjectState: true,
    preservePermanentBiography: true,
    preserveDevelopmentLedger: true,
    derivativeTraceRefsOnly: true,
  });
  assert.equal(rejectsMissingVersion.accepted, false);
  assert.equal(
    rejectsMissingVersion.reason,
    LIFECYCLE_REJECTION_REASON.COMPACTION_VERSION_REF_MISSING,
  );

  const accepted = await store.recordRetentionCompaction({
    compactionRunId: 'compaction-safe',
    policyKind: 'field_journal_compaction',
    mode: RETENTION_COMPACTION_MODE.AGGREGATE_ONLY,
    subjectRef: 'journal:window-3',
    sourceRefs: ['subject-state:snapshot-1'],
    targetRefs: ['journal:summary-3'],
    preservedRefs: ['subject-state:snapshot-1', 'development-ledger:all'],
    deletedTraceRefs: ['trace:derived-1'],
    evidenceRefs: ['policy:retention-1'],
    occurredAt: '2026-04-15T12:12:00.000Z',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'compaction:safe',
    subjectStateSchemaVersion: '017_perimeter_trusted_ingress.sql',
    dependsOnSubjectState: true,
    preservePermanentBiography: true,
    preserveDevelopmentLedger: true,
    derivativeTraceRefsOnly: true,
  });
  assert.equal(accepted.accepted, true);
  assert.equal(
    accepted.compactionRun.subjectStateSchemaVersion,
    '017_perimeter_trusted_ingress.sql',
  );
});

void test('AC-F0019-15 AC-F0019-16 exposes rollback and graceful-shutdown evidence as read-only source data', async () => {
  const harness = createHarness();
  const store = createLifecycleStore(harness.db);

  await store.recordRollbackIncident({
    rollbackIncidentId: 'rollback-1',
    incidentKind: 'body_rollback',
    severity: 'warning',
    rollbackRef: 'body:snapshot-1',
    subjectRef: 'runtime:polyphony-core',
    evidenceRefs: ['body:snapshot-1'],
    recordedAt: '2026-04-15T12:20:00.000Z',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'rollback:source:1',
  });
  await store.recordGracefulShutdown({
    shutdownEventId: 'shutdown-1',
    shutdownState: 'completed',
    reason: 'runtime.stop',
    subjectRef: 'runtime:polyphony-core',
    admittedInFlightWork: [{ tickId: 'tick-1' }],
    terminalTickOutcome: { activeTickCountAfterStop: 0 },
    flushedBufferResult: { tickRuntime: 'stopped' },
    openConcerns: [],
    evidenceRefs: ['tick:tick-1'],
    recordedAt: '2026-04-15T12:21:00.000Z',
    schemaVersion: '018_lifecycle_consolidation.sql',
    idempotencyKey: 'shutdown:source:1',
  });
  harness.activeTicks.push({
    tickId: 'tick-active',
    requestId: 'request-active',
    tickKind: 'reactive',
    status: 'started',
    startedAt: '2026-04-15T12:22:00.000Z',
    leaseExpiresAt: '2026-04-15T12:23:00.000Z',
  });

  const source = await store.loadRollbackFrequencySource({
    since: '2026-04-15T12:00:00.000Z',
    until: '2026-04-15T13:00:00.000Z',
  });
  const active = await store.listActiveTickWork();

  assert.equal(source.metricValue, 1);
  assert.equal(source.rollbackIncidentCount, 1);
  assert.equal(source.gracefulShutdownEvidenceCount, 1);
  assert.deepEqual(source.evidenceRefs.sort(), [
    'graceful_shutdown:shutdown-1',
    'rollback_incident:rollback-1',
  ]);
  assert.equal(active[0]?.tickId, 'tick-active');
});
