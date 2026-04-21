import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORTING_FOREIGN_WRITE_SURFACE,
  REPORT_AVAILABILITY,
  REPORT_FAMILY,
  REPORT_PUBLICATION_STATUS,
  REPORT_SOURCE_OWNER,
} from '@yaagi/contracts/reporting';
import {
  createReportingStore,
  type ReportingDbExecutor,
  type ReportRunRow,
} from '../src/reporting.ts';

type Harness = {
  db: ReportingDbExecutor;
  reportRuns: ReportRunRow[];
};

const parseJson = <T>(value: unknown): T => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
};

const createHarness = (): Harness => {
  const reportRuns: ReportRunRow[] = [];

  const query = ((sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('reporting db harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

    if (
      sql.includes('from polyphony_runtime.report_runs') &&
      sql.includes('where report_family = $1 and source_snapshot_signature = $2')
    ) {
      const row = reportRuns.find(
        (entry) => entry.reportFamily === params[0] && entry.sourceSnapshotSignature === params[1],
      );
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.report_runs')) {
      const existing = reportRuns.find(
        (entry) => entry.reportFamily === params[1] && entry.sourceSnapshotSignature === params[4],
      );
      if (existing) {
        return Promise.resolve({ rows: [] });
      }

      const row: ReportRunRow = {
        reportRunId: params[0] as string,
        reportFamily: params[1] as ReportRunRow['reportFamily'],
        sourceRefsJson: parseJson<string[]>(params[2]),
        sourceOwnerRefsJson: parseJson<ReportRunRow['sourceOwnerRefsJson']>(params[3]),
        sourceSnapshotSignature: params[4] as string,
        materializedAt: params[5] as string,
        availabilityStatus: params[6] as ReportRunRow['availabilityStatus'],
        schemaVersion: params[7] as string,
        publicationJson: parseJson<ReportRunRow['publicationJson']>(params[8]),
        createdAt: params[5] as string,
      };
      reportRuns.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.report_runs') &&
      sql.includes('where report_family = $1') &&
      sql.includes('order by materialized_at desc')
    ) {
      const rows = reportRuns
        .filter((entry) => entry.reportFamily === params[0])
        .sort(
          (left, right) =>
            right.materializedAt.localeCompare(left.materializedAt) ||
            right.reportRunId.localeCompare(left.reportRunId),
        )
        .slice(0, Number(params[1]));
      return Promise.resolve({ rows });
    }

    if (
      sql.includes('from polyphony_runtime.report_runs') &&
      sql.includes('order by materialized_at desc')
    ) {
      const rows = [...reportRuns]
        .sort(
          (left, right) =>
            right.materializedAt.localeCompare(left.materializedAt) ||
            right.reportRunId.localeCompare(left.reportRunId),
        )
        .slice(0, Number(params[0]));
      return Promise.resolve({ rows });
    }

    throw new Error(`unsupported sql in reporting db harness: ${sqlText}`);
  }) as ReportingDbExecutor['query'];

  return { db: { query } as ReportingDbExecutor, reportRuns };
};

void test('AC-F0023-01 AC-F0023-10 AC-F0023-15 records report-run provenance and publication metadata', async () => {
  const harness = createHarness();
  const store = createReportingStore(harness.db);

  const result = await store.recordReportRun({
    reportRunId: 'report-run-identity-1',
    reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
    sourceRefs: ['snapshot:snapshot-1', 'tick:tick-1', 'tick:tick-1'],
    sourceOwnerRefs: [REPORT_SOURCE_OWNER.BODY_EVOLUTION, REPORT_SOURCE_OWNER.TICK_RUNTIME],
    sourceSnapshotSignature: 'sig:identity:1',
    materializedAt: '2026-04-21T16:40:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.FRESH,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {
      metrics: {
        status: REPORT_PUBLICATION_STATUS.PUBLISHED,
        publishedAt: '2026-04-21T16:40:01.000Z',
        ref: 'metric:identity_continuity',
        detail: null,
      },
    },
  });

  assert.equal(result.accepted, true);
  if (!result.accepted) {
    return;
  }

  assert.equal(result.deduplicated, false);
  assert.deepEqual(result.reportRun.sourceRefsJson, ['snapshot:snapshot-1', 'tick:tick-1']);
  assert.deepEqual(result.reportRun.sourceOwnerRefsJson, [
    REPORT_SOURCE_OWNER.TICK_RUNTIME,
    REPORT_SOURCE_OWNER.BODY_EVOLUTION,
  ]);
  assert.equal(result.reportRun.availabilityStatus, REPORT_AVAILABILITY.FRESH);
  assert.equal(
    result.reportRun.publicationJson.metrics?.status,
    REPORT_PUBLICATION_STATUS.PUBLISHED,
  );
  assert.equal(harness.reportRuns.length, 1);
});

void test('AC-F0023-02 AC-F0023-10 deduplicates the same report family and source snapshot signature', async () => {
  const harness = createHarness();
  const store = createReportingStore(harness.db);

  const first = await store.recordReportRun({
    reportRunId: 'report-run-model-1',
    reportFamily: REPORT_FAMILY.MODEL_HEALTH,
    sourceRefs: ['profile-health:reflection.deep@shared'],
    sourceOwnerRefs: [
      REPORT_SOURCE_OWNER.BASELINE_MODEL_ROUTING,
      REPORT_SOURCE_OWNER.EXPANDED_MODEL_ECOLOGY,
    ],
    sourceSnapshotSignature: 'sig:model-health:1',
    materializedAt: '2026-04-21T16:45:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.DEGRADED,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {},
  });

  const replay = await store.recordReportRun({
    reportRunId: 'report-run-model-replay',
    reportFamily: REPORT_FAMILY.MODEL_HEALTH,
    sourceRefs: ['profile-health:reflection.deep@shared'],
    sourceOwnerRefs: [
      REPORT_SOURCE_OWNER.EXPANDED_MODEL_ECOLOGY,
      REPORT_SOURCE_OWNER.BASELINE_MODEL_ROUTING,
    ],
    sourceSnapshotSignature: 'sig:model-health:1',
    materializedAt: '2026-04-21T16:46:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.DEGRADED,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {
      logs: {
        status: REPORT_PUBLICATION_STATUS.FAILED,
        publishedAt: null,
        ref: null,
        detail: 'export timeout',
      },
    },
  });

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  if (!first.accepted || !replay.accepted) {
    return;
  }

  assert.equal(replay.deduplicated, true);
  assert.equal(replay.reportRun.reportRunId, first.reportRun.reportRunId);
  assert.equal(harness.reportRuns.length, 1);

  const listed = await store.listReportRuns({ reportFamily: REPORT_FAMILY.MODEL_HEALTH, limit: 5 });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.reportRunId, 'report-run-model-1');
});

void test('AC-F0023-03 rejects foreign-owner write surfaces without persisting report runs', async () => {
  const harness = createHarness();
  const store = createReportingStore(harness.db);

  const result = await store.recordReportRun({
    reportRunId: 'report-run-boundary-1',
    reportFamily: REPORT_FAMILY.DEVELOPMENT_DIAGNOSTICS,
    sourceRefs: ['proposal:freeze-1'],
    sourceOwnerRefs: [REPORT_SOURCE_OWNER.DEVELOPMENT_GOVERNOR],
    sourceSnapshotSignature: 'sig:development:1',
    materializedAt: '2026-04-21T16:50:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.UNAVAILABLE,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {},
    requestedWriteSurfaces: [REPORTING_FOREIGN_WRITE_SURFACE.SUBJECT_STATE],
  });

  assert.deepEqual(result, {
    accepted: false,
    reason: 'foreign_owner_write_rejected',
    rejectedWriteSurface: REPORTING_FOREIGN_WRITE_SURFACE.SUBJECT_STATE,
  });
  assert.equal(harness.reportRuns.length, 0);
});
