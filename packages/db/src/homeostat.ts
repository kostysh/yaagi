import type { Client, QueryResultRow } from 'pg';
import type {
  HomeostatAlert,
  HomeostatCadenceKind,
  HomeostatSignalFamily,
  HomeostatSignalScore,
  HomeostatSnapshot,
} from '@yaagi/contracts/runtime';

export type HomeostatDbExecutor = Pick<Client, 'query'>;

const RUNTIME_SCHEMA = 'polyphony_runtime';

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;
const homeostatSnapshotsTable = runtimeSchemaTable('homeostat_snapshots');

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const homeostatSnapshotColumns = `
  snapshot_id as "snapshotId",
  cadence_kind as "cadenceKind",
  tick_id as "tickId",
  overall_stability::float8 as "overallStability",
  affect_volatility::float8 as "affectVolatility",
  goal_churn::float8 as "goalChurn",
  coalition_dominance::float8 as "coalitionDominance",
  narrative_rewrite_rate::float8 as "narrativeRewriteRate",
  development_proposal_rate::float8 as "developmentProposalRate",
  resource_pressure::float8 as "resourcePressure",
  organ_error_rate::float8 as "organErrorRate",
  rollback_frequency::float8 as "rollbackFrequency",
  development_freeze as "developmentFreeze",
  signal_status_json as "signalScoresJson",
  alerts_json as "alertsJson",
  reaction_request_refs_json as "reactionRequestRefsJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

type HomeostatSnapshotRowRecord = {
  snapshotId: string;
  cadenceKind: HomeostatCadenceKind;
  tickId: string | null;
  overallStability: number | string;
  affectVolatility: number | string | null;
  goalChurn: number | string | null;
  coalitionDominance: number | string | null;
  narrativeRewriteRate: number | string | null;
  developmentProposalRate: number | string | null;
  resourcePressure: number | string | null;
  organErrorRate: number | string | null;
  rollbackFrequency: number | string | null;
  developmentFreeze: boolean;
  signalScoresJson: unknown;
  alertsJson: unknown;
  reactionRequestRefsJson: unknown;
  createdAt: string | Date;
};

export type HomeostatSnapshotRow = HomeostatSnapshot & {
  metricColumns: Record<HomeostatSignalFamily, number | null>;
};

export type PersistHomeostatSnapshotInput = {
  snapshot: HomeostatSnapshot;
};

export type ListHomeostatSnapshotsInput = {
  limit?: number;
};

export type HomeostatStore = {
  persistSnapshot(input: PersistHomeostatSnapshotInput): Promise<HomeostatSnapshotRow>;
  updateReactionRequestRefs(input: {
    snapshotId: string;
    reactionRequestRefs: string[];
  }): Promise<HomeostatSnapshotRow>;
  loadLatestSnapshot(): Promise<HomeostatSnapshotRow | null>;
  listRecentSnapshots(input?: ListHomeostatSnapshotsInput): Promise<HomeostatSnapshotRow[]>;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`homeostat numeric field must be coercible to number, received ${String(value)}`);
};

const toNullableNumber = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }

  return toNumber(value);
};

const normalizeTimestamp = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`homeostat field ${field} must be a string or Date timestamp`);
};

const isSignalScore = (value: unknown): value is HomeostatSignalScore => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['signalFamily'] === 'string' &&
    typeof candidate['status'] === 'string' &&
    typeof candidate['warningThreshold'] === 'number' &&
    typeof candidate['criticalThreshold'] === 'number' &&
    typeof candidate['severity'] === 'string' &&
    Array.isArray(candidate['evidenceRefs'])
  );
};

const isAlert = (value: unknown): value is HomeostatAlert => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['signalFamily'] === 'string' &&
    typeof candidate['status'] === 'string' &&
    typeof candidate['severity'] === 'string' &&
    Array.isArray(candidate['evidenceRefs']) &&
    Array.isArray(candidate['requestedActionKinds']) &&
    Array.isArray(candidate['idempotencyKeys'])
  );
};

const normalizeSignalScores = (value: unknown): HomeostatSignalScore[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isSignalScore).map((score) => ({
    ...score,
    metricValue: score.metricValue == null ? null : toNumber(score.metricValue),
  }));
};

const normalizeAlerts = (value: unknown): HomeostatAlert[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isAlert).map((alert) => ({
    ...alert,
    metricValue: alert.metricValue == null ? null : toNumber(alert.metricValue),
  }));
};

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const extractMetricColumns = (
  row: HomeostatSnapshotRowRecord,
): Record<HomeostatSignalFamily, number | null> => ({
  affect_volatility: toNullableNumber(row.affectVolatility),
  goal_churn: toNullableNumber(row.goalChurn),
  coalition_dominance: toNullableNumber(row.coalitionDominance),
  narrative_rewrite_rate: toNullableNumber(row.narrativeRewriteRate),
  development_proposal_rate: toNullableNumber(row.developmentProposalRate),
  resource_pressure: toNullableNumber(row.resourcePressure),
  organ_error_rate: toNullableNumber(row.organErrorRate),
  rollback_frequency: toNullableNumber(row.rollbackFrequency),
});

const normalizeSnapshotRow = (row: QueryResultRow): HomeostatSnapshotRow => {
  const snapshot = row as unknown as HomeostatSnapshotRowRecord;
  return {
    snapshotId: snapshot.snapshotId,
    cadenceKind: snapshot.cadenceKind,
    tickId: snapshot.tickId ?? null,
    overallStability: toNumber(snapshot.overallStability),
    signalScores: normalizeSignalScores(snapshot.signalScoresJson),
    alerts: normalizeAlerts(snapshot.alertsJson),
    reactionRequestRefs: normalizeStringArray(snapshot.reactionRequestRefsJson),
    developmentFreeze: snapshot.developmentFreeze,
    createdAt: normalizeTimestamp(snapshot.createdAt, 'homeostat_snapshots.createdAt'),
    metricColumns: extractMetricColumns(snapshot),
  };
};

const getMetricValue = (
  signalScores: HomeostatSignalScore[],
  signalFamily: HomeostatSignalFamily,
): number | null =>
  signalScores.find((score) => score.signalFamily === signalFamily)?.metricValue ?? null;

export function createHomeostatStore(db: HomeostatDbExecutor): HomeostatStore {
  return {
    async persistSnapshot(input: PersistHomeostatSnapshotInput): Promise<HomeostatSnapshotRow> {
      const { snapshot } = input;
      const result = await db.query<HomeostatSnapshotRow>(
        `insert into ${homeostatSnapshotsTable} (
           snapshot_id,
           cadence_kind,
           tick_id,
           overall_stability,
           affect_volatility,
           goal_churn,
           coalition_dominance,
           narrative_rewrite_rate,
           development_proposal_rate,
           resource_pressure,
           organ_error_rate,
           rollback_frequency,
           development_freeze,
           signal_status_json,
           alerts_json,
           reaction_request_refs_json,
           created_at
         ) values (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           $10,
           $11,
           $12,
           $13,
           $14::jsonb,
           $15::jsonb,
           $16::jsonb,
           $17
         )
         returning ${homeostatSnapshotColumns}`,
        [
          snapshot.snapshotId,
          snapshot.cadenceKind,
          snapshot.tickId,
          snapshot.overallStability,
          getMetricValue(snapshot.signalScores, 'affect_volatility'),
          getMetricValue(snapshot.signalScores, 'goal_churn'),
          getMetricValue(snapshot.signalScores, 'coalition_dominance'),
          getMetricValue(snapshot.signalScores, 'narrative_rewrite_rate'),
          getMetricValue(snapshot.signalScores, 'development_proposal_rate'),
          getMetricValue(snapshot.signalScores, 'resource_pressure'),
          getMetricValue(snapshot.signalScores, 'organ_error_rate'),
          getMetricValue(snapshot.signalScores, 'rollback_frequency'),
          snapshot.developmentFreeze,
          JSON.stringify(snapshot.signalScores),
          JSON.stringify(snapshot.alerts),
          JSON.stringify(snapshot.reactionRequestRefs),
          snapshot.createdAt,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error(`failed to persist homeostat snapshot ${snapshot.snapshotId}`);
      }

      return normalizeSnapshotRow(row);
    },

    async loadLatestSnapshot(): Promise<HomeostatSnapshotRow | null> {
      const result = await db.query<HomeostatSnapshotRow>(
        `select ${homeostatSnapshotColumns}
         from ${homeostatSnapshotsTable}
         order by created_at desc, snapshot_id desc
         limit 1`,
      );

      const row = result.rows[0];
      return row ? normalizeSnapshotRow(row) : null;
    },

    async updateReactionRequestRefs(input: {
      snapshotId: string;
      reactionRequestRefs: string[];
    }): Promise<HomeostatSnapshotRow> {
      const result = await db.query<HomeostatSnapshotRow>(
        `update ${homeostatSnapshotsTable}
         set reaction_request_refs_json = $2::jsonb
         where snapshot_id = $1
         returning ${homeostatSnapshotColumns}`,
        [input.snapshotId, JSON.stringify(input.reactionRequestRefs)],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error(
          `failed to update reaction refs for homeostat snapshot ${input.snapshotId}`,
        );
      }

      return normalizeSnapshotRow(row);
    },

    async listRecentSnapshots(
      input: ListHomeostatSnapshotsInput = {},
    ): Promise<HomeostatSnapshotRow[]> {
      const limit = input.limit ?? 20;
      const result = await db.query<HomeostatSnapshotRow>(
        `select ${homeostatSnapshotColumns}
         from ${homeostatSnapshotsTable}
         order by created_at desc, snapshot_id desc
         limit $1`,
        [limit],
      );

      return result.rows.map((row) => normalizeSnapshotRow(row));
    },
  };
}
