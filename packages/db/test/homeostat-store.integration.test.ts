import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOMEOSTAT_ALERT_SEVERITY,
  HOMEOSTAT_CADENCE_KIND,
  HOMEOSTAT_REQUESTED_ACTION_KIND,
  HOMEOSTAT_SIGNAL_FAMILY,
  HOMEOSTAT_SIGNAL_STATUS,
  type HomeostatSnapshot,
} from '@yaagi/contracts/runtime';
import { createHomeostatStore, type HomeostatDbExecutor } from '../src/homeostat.ts';

type StoredRow = {
  snapshotId: string;
  cadenceKind: string;
  tickId: string | null;
  overallStability: number;
  affectVolatility: number | null;
  goalChurn: number | null;
  coalitionDominance: number | null;
  narrativeRewriteRate: number | null;
  developmentProposalRate: number | null;
  resourcePressure: number | null;
  organErrorRate: number | null;
  rollbackFrequency: number | null;
  developmentFreeze: boolean;
  signalScoresJson: unknown;
  alertsJson: unknown;
  reactionRequestRefsJson: unknown;
  createdAt: Date;
};

const createSnapshot = (): HomeostatSnapshot => ({
  snapshotId: 'snapshot-homeostat-1',
  cadenceKind: HOMEOSTAT_CADENCE_KIND.TICK_COMPLETE,
  tickId: 'tick-homeostat-1',
  overallStability: 0.58,
  signalScores: [
    {
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.AFFECT_VOLATILITY,
      status: HOMEOSTAT_SIGNAL_STATUS.EVALUATED,
      metricValue: 0.82,
      warningThreshold: 0.45,
      criticalThreshold: 0.7,
      severity: HOMEOSTAT_ALERT_SEVERITY.CRITICAL,
      evidenceRefs: ['narrative:narrative-homeostat-1'],
    },
    {
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.RESOURCE_PRESSURE,
      status: HOMEOSTAT_SIGNAL_STATUS.EVALUATED,
      metricValue: 0.8,
      warningThreshold: 0.75,
      criticalThreshold: 0.9,
      severity: HOMEOSTAT_ALERT_SEVERITY.WARNING,
      evidenceRefs: ['runtime:resource-posture'],
    },
  ],
  alerts: [
    {
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.AFFECT_VOLATILITY,
      status: HOMEOSTAT_SIGNAL_STATUS.EVALUATED,
      severity: HOMEOSTAT_ALERT_SEVERITY.CRITICAL,
      metricValue: 0.82,
      warningThreshold: 0.45,
      criticalThreshold: 0.7,
      evidenceRefs: ['narrative:narrative-homeostat-1'],
      requestedActionKinds: [HOMEOSTAT_REQUESTED_ACTION_KIND.REFLECTIVE_COUNTERWEIGHT],
      idempotencyKeys: ['affect|critical|reflective_counterweight'],
    },
  ],
  reactionRequestRefs: ['reaction-homeostat-1'],
  developmentFreeze: false,
  createdAt: '2026-03-25T13:00:00.000Z',
});

const createHomeostatDbHarness = (): {
  db: HomeostatDbExecutor;
  rows: StoredRow[];
} => {
  const rows: StoredRow[] = [];

  const query = ((sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('homeostat db harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

    if (sql.startsWith('insert into polyphony_runtime.homeostat_snapshots')) {
      const row: StoredRow = {
        snapshotId: params[0] as string,
        cadenceKind: params[1] as string,
        tickId: (params[2] as string | null) ?? null,
        overallStability: Number(params[3]),
        affectVolatility: params[4] == null ? null : Number(params[4]),
        goalChurn: params[5] == null ? null : Number(params[5]),
        coalitionDominance: params[6] == null ? null : Number(params[6]),
        narrativeRewriteRate: params[7] == null ? null : Number(params[7]),
        developmentProposalRate: params[8] == null ? null : Number(params[8]),
        resourcePressure: params[9] == null ? null : Number(params[9]),
        organErrorRate: params[10] == null ? null : Number(params[10]),
        rollbackFrequency: params[11] == null ? null : Number(params[11]),
        developmentFreeze: Boolean(params[12]),
        signalScoresJson: JSON.parse(String(params[13])),
        alertsJson: JSON.parse(String(params[14])),
        reactionRequestRefsJson: JSON.parse(String(params[15])),
        createdAt: new Date(String(params[16])),
      };
      rows.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('update polyphony_runtime.homeostat_snapshots')) {
      const row = rows.find((entry) => entry.snapshotId === params[0]);
      if (!row) {
        return Promise.resolve({ rows: [] });
      }
      row.reactionRequestRefsJson = JSON.parse(String(params[1]));
      return Promise.resolve({ rows: [row] });
    }

    if (sql.includes('from polyphony_runtime.homeostat_snapshots') && sql.includes('limit 1')) {
      const [row] = [...rows].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.includes('from polyphony_runtime.homeostat_snapshots') && sql.includes('limit $1')) {
      return Promise.resolve({
        rows: [...rows]
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, Number(params[0] ?? 20)),
      });
    }

    throw new Error(`unsupported sql in homeostat db harness: ${sqlText}`);
  }) as HomeostatDbExecutor['query'];

  const db = {
    query,
  } as HomeostatDbExecutor;

  return { db, rows };
};

void test('AC-F0012-06 persists deterministic homeostat snapshots for replay and read-only downstream consumption', async () => {
  const harness = createHomeostatDbHarness();
  const store = createHomeostatStore(harness.db);

  await store.persistSnapshot({ snapshot: createSnapshot() });
  const latest = await store.loadLatestSnapshot();

  assert.ok(latest);
  assert.equal(latest.snapshotId, 'snapshot-homeostat-1');
  assert.equal(latest.createdAt, '2026-03-25T13:00:00.000Z');
  assert.equal(latest.metricColumns.affect_volatility, 0.82);
  assert.equal(latest.metricColumns.resource_pressure, 0.8);
});

void test('AC-F0012-01 snapshot/reaction persistence boundary keeps advisory reaction refs separate from signal scores', async () => {
  const harness = createHomeostatDbHarness();
  const store = createHomeostatStore(harness.db);

  await store.persistSnapshot({
    snapshot: {
      ...createSnapshot(),
      reactionRequestRefs: [],
    },
  });
  const updated = await store.updateReactionRequestRefs({
    snapshotId: 'snapshot-homeostat-1',
    reactionRequestRefs: ['reaction-homeostat-1', 'reaction-homeostat-2'],
  });

  assert.deepEqual(updated.reactionRequestRefs, ['reaction-homeostat-1', 'reaction-homeostat-2']);
  assert.equal(updated.signalScores.length, 2);
  assert.equal(harness.rows[0]?.developmentFreeze, false);
});
