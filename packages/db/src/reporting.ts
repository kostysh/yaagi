import type { Client, QueryResultRow } from 'pg';
import {
  REPORTING_REJECTION_REASON,
  REPORT_AVAILABILITY,
  REPORT_FAMILY,
  assertReportingOwnedWriteSurface,
  assertValidReportPublicationMetadata,
  assertValidReportRun,
  isReportSourceOwner,
  type DevelopmentDiagnosticsReport,
  type IdentityContinuityReport,
  type LifecycleDiagnosticsReport,
  type ModelHealthReport,
  type OrganErrorRateSource,
  type ReportAvailability,
  type ReportFamily,
  type ReportPublicationMetadata,
  type ReportRun,
  type ReportSourceOwner,
  type StableSnapshotInventoryEntry,
  type StableSnapshotInventoryReport,
} from '@yaagi/contracts/reporting';
import { RUNTIME_SCHEMA } from './runtime.ts';

export type ReportingDbExecutor = Pick<Client, 'query'>;

export type ReportRunRow = {
  reportRunId: string;
  reportFamily: ReportFamily;
  sourceRefsJson: string[];
  sourceOwnerRefsJson: ReportSourceOwner[];
  sourceSnapshotSignature: string;
  materializedAt: string;
  availabilityStatus: ReportAvailability;
  schemaVersion: string;
  publicationJson: ReportPublicationMetadata;
  createdAt: string;
};

export type RecordReportRunInput = ReportRun & {
  requestedWriteSurfaces?: string[];
};

export type RecordReportRunResult =
  | {
      accepted: true;
      deduplicated: boolean;
      reportRun: ReportRunRow;
    }
  | {
      accepted: false;
      reason: typeof REPORTING_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED;
      rejectedWriteSurface: string;
    };

export type ListReportRunsInput = {
  reportFamily?: ReportFamily;
  limit?: number;
};

export type UpdateReportPublicationInput = {
  reportRunId: string;
  publication: ReportPublicationMetadata;
};

export type ListModelHealthReportsInput = {
  reportRunId?: string;
  latest?: boolean;
};

export type ReplaceModelHealthReportsInput = {
  reportRunId: string;
  reports: ModelHealthReport[];
};

export type ReportingStore = {
  assertOwnedWriteSurface(surface: string): void;
  recordReportRun(input: RecordReportRunInput): Promise<RecordReportRunResult>;
  getReportRun(reportRunId: string): Promise<ReportRunRow | null>;
  getLatestReportRun(reportFamily: ReportFamily): Promise<ReportRunRow | null>;
  updateReportPublication(input: UpdateReportPublicationInput): Promise<ReportRunRow>;
  listReportRuns(input?: ListReportRunsInput): Promise<ReportRunRow[]>;
  upsertIdentityContinuityReport(
    report: IdentityContinuityReport,
  ): Promise<IdentityContinuityReport>;
  getIdentityContinuityReport(reportRunId: string): Promise<IdentityContinuityReport | null>;
  getLatestIdentityContinuityReport(): Promise<IdentityContinuityReport | null>;
  replaceModelHealthReports(input: ReplaceModelHealthReportsInput): Promise<ModelHealthReport[]>;
  listModelHealthReports(input?: ListModelHealthReportsInput): Promise<ModelHealthReport[]>;
  upsertStableSnapshotInventoryReport(
    report: StableSnapshotInventoryReport,
  ): Promise<StableSnapshotInventoryReport>;
  getStableSnapshotInventoryReport(
    reportRunId: string,
  ): Promise<StableSnapshotInventoryReport | null>;
  getLatestStableSnapshotInventoryReport(): Promise<StableSnapshotInventoryReport | null>;
  upsertDevelopmentDiagnosticsReport(
    report: DevelopmentDiagnosticsReport,
  ): Promise<DevelopmentDiagnosticsReport>;
  getDevelopmentDiagnosticsReport(
    reportRunId: string,
  ): Promise<DevelopmentDiagnosticsReport | null>;
  getLatestDevelopmentDiagnosticsReport(): Promise<DevelopmentDiagnosticsReport | null>;
  upsertLifecycleDiagnosticsReport(
    report: LifecycleDiagnosticsReport,
  ): Promise<LifecycleDiagnosticsReport>;
  getLifecycleDiagnosticsReport(reportRunId: string): Promise<LifecycleDiagnosticsReport | null>;
  getLatestLifecycleDiagnosticsReport(): Promise<LifecycleDiagnosticsReport | null>;
  loadOrganErrorRateSource(): Promise<OrganErrorRateSource | null>;
};

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;
const reportRunsTable = runtimeSchemaTable('report_runs');
const identityContinuityReportsTable = runtimeSchemaTable('identity_continuity_reports');
const modelHealthReportsTable = runtimeSchemaTable('model_health_reports');
const stableSnapshotInventoryReportsTable = runtimeSchemaTable('stable_snapshot_inventory_reports');
const developmentDiagnosticsReportsTable = runtimeSchemaTable('development_diagnostics_reports');
const lifecycleDiagnosticsReportsTable = runtimeSchemaTable('lifecycle_diagnostics_reports');

const reportRunColumns = `
  report_run_id as "reportRunId",
  report_family as "reportFamily",
  source_refs_json as "sourceRefsJson",
  source_owner_refs_json as "sourceOwnerRefsJson",
  source_snapshot_signature as "sourceSnapshotSignature",
  ${asUtcIso('materialized_at', 'materializedAt')},
  availability_status as "availabilityStatus",
  schema_version as "schemaVersion",
  publication_json as "publicationJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const identityContinuityColumns = `
  icr.report_run_id as "reportRunId",
  rr.source_refs_json as "sourceRefsJson",
  rr.source_owner_refs_json as "sourceOwnerRefsJson",
  icr.availability_status as "availability",
  ${asUtcIso('icr.materialized_at', 'materializedAt')},
  icr.runtime_mode as "runtimeMode",
  icr.current_tick_ref as "currentTickRef",
  icr.last_stable_snapshot_ref as "lastStableSnapshotRef",
  icr.recent_recovery_refs_json as "recentRecoveryRefsJson"
`;

const modelHealthColumns = `
  mhr.report_run_id as "reportRunId",
  rr.source_refs_json as "sourceRefsJson",
  rr.source_owner_refs_json as "sourceOwnerRefsJson",
  mhr.availability_status as "availability",
  ${asUtcIso('mhr.materialized_at', 'materializedAt')},
  mhr.organ_id as "organId",
  mhr.profile_id as "profileId",
  mhr.health_status as "healthStatus",
  mhr.error_rate::float8 as "errorRate",
  mhr.fallback_ref as "fallbackRef",
  mhr.source_surface_refs_json as "sourceSurfaceRefsJson"
`;

const stableSnapshotInventoryColumns = `
  ssir.report_run_id as "reportRunId",
  rr.source_refs_json as "sourceRefsJson",
  rr.source_owner_refs_json as "sourceOwnerRefsJson",
  ssir.availability_status as "availability",
  ${asUtcIso('ssir.materialized_at', 'materializedAt')},
  ssir.latest_stable_snapshot_ref as "latestStableSnapshotRef",
  ssir.total_snapshots as "totalSnapshots",
  ssir.snapshots_json as "snapshotsJson"
`;

const developmentDiagnosticsColumns = `
  ddr.report_run_id as "reportRunId",
  rr.source_refs_json as "sourceRefsJson",
  rr.source_owner_refs_json as "sourceOwnerRefsJson",
  ddr.availability_status as "availability",
  ${asUtcIso('ddr.materialized_at', 'materializedAt')},
  ddr.development_freeze_active as "developmentFreezeActive",
  ddr.ledger_entry_count_last_30d as "ledgerEntryCountLast30d",
  ddr.proposal_count_last_30d as "proposalCountLast30d",
  ddr.recent_ledger_refs_json as "recentLedgerRefsJson",
  ddr.recent_failed_action_refs_json as "recentFailedActionRefsJson"
`;

const lifecycleDiagnosticsColumns = `
  ldr.report_run_id as "reportRunId",
  rr.source_refs_json as "sourceRefsJson",
  rr.source_owner_refs_json as "sourceOwnerRefsJson",
  ldr.availability_status as "availability",
  ${asUtcIso('ldr.materialized_at', 'materializedAt')},
  ldr.rollback_incident_count_last_30d as "rollbackIncidentCountLast30d",
  ldr.graceful_shutdown_count_last_30d as "gracefulShutdownCountLast30d",
  ldr.recent_rollback_refs_json as "recentRollbackRefsJson",
  ldr.recent_graceful_shutdown_refs_json as "recentGracefulShutdownRefsJson",
  ldr.recent_compaction_refs_json as "recentCompactionRefsJson"
`;

function asUtcIso(column: string, alias: string): string {
  return `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;
}

const normalizeTimestamp = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`reporting row field ${field} must be a string or Date timestamp`);
};

const normalizeStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`reporting row field ${field} must be an array`);
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized)).sort();
};

const normalizeSourceOwnerRefs = (value: unknown): ReportSourceOwner[] => {
  const refs = normalizeStringArray(value, 'sourceOwnerRefsJson');
  if (!refs.every(isReportSourceOwner)) {
    throw new Error('reporting row field sourceOwnerRefsJson must contain canonical owners');
  }
  return refs;
};

const toPublicationMetadata = (value: unknown): ReportPublicationMetadata => {
  const metadata =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as ReportPublicationMetadata)
      : {};
  assertValidReportPublicationMetadata(metadata);
  return metadata;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const toStringRecord = (value: unknown): Record<string, string> => {
  const record = toRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};

const normalizeNumber = (value: unknown, field: string): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`reporting row field ${field} must be a numeric value`);
};

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const printable =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value == null
      ? String(value)
      : (JSON.stringify(value) ?? Object.prototype.toString.call(value));
  throw new Error(`reporting row numeric value is invalid: ${printable}`);
};

const normalizeStableSnapshotEntries = (value: unknown): StableSnapshotInventoryEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        entry !== null && typeof entry === 'object' && !Array.isArray(entry),
    )
    .map((entry) => ({
      snapshotRef: typeof entry['snapshotRef'] === 'string' ? entry['snapshotRef'] : '',
      proposalId: typeof entry['proposalId'] === 'string' ? entry['proposalId'] : '',
      gitTag: typeof entry['gitTag'] === 'string' ? entry['gitTag'] : '',
      schemaVersion: typeof entry['schemaVersion'] === 'string' ? entry['schemaVersion'] : '',
      isCurrentStable: entry['isCurrentStable'] === true,
      createdAt:
        typeof entry['createdAt'] === 'string' ? entry['createdAt'] : new Date(0).toISOString(),
      rollbackAnchorRefs: normalizeStringArray(
        Array.isArray(entry['rollbackAnchorRefs']) ? entry['rollbackAnchorRefs'] : [],
        'snapshotsJson.rollbackAnchorRefs',
      ),
      modelProfileMap: toStringRecord(entry['modelProfileMap']),
    }))
    .filter((entry) => entry.snapshotRef.length > 0);
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

const normalizeInputStringArray = (value: string[]): string[] =>
  Array.from(
    new Set(value.map((entry) => entry.trim()).filter((entry) => entry.length > 0)),
  ).sort();

const normalizeReportRunRow = (row: ReportRunRow): ReportRunRow => ({
  ...row,
  sourceRefsJson: normalizeStringArray(row.sourceRefsJson, 'sourceRefsJson'),
  sourceOwnerRefsJson: normalizeSourceOwnerRefs(row.sourceOwnerRefsJson),
  materializedAt: normalizeTimestamp(row.materializedAt, 'materializedAt'),
  publicationJson: toPublicationMetadata(row.publicationJson),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
});

const normalizeReportRunInput = (input: RecordReportRunInput): ReportRun => ({
  reportRunId: input.reportRunId.trim(),
  reportFamily: input.reportFamily,
  sourceRefs: normalizeInputStringArray(input.sourceRefs),
  sourceOwnerRefs: normalizeInputStringArray(input.sourceOwnerRefs) as ReportSourceOwner[],
  sourceSnapshotSignature: input.sourceSnapshotSignature.trim(),
  materializedAt: input.materializedAt,
  availabilityStatus: input.availabilityStatus,
  schemaVersion: input.schemaVersion.trim(),
  publication: input.publication ?? {},
});

const normalizeMaterializedIdentity = (row: {
  reportRunId: string;
  sourceRefsJson: unknown;
  sourceOwnerRefsJson: unknown;
  availability: unknown;
  materializedAt: unknown;
  reportFamily: ReportFamily;
}) => ({
  reportRunId: row.reportRunId,
  reportFamily: row.reportFamily,
  sourceRefs: normalizeStringArray(row.sourceRefsJson, 'sourceRefsJson'),
  sourceOwnerRefs: normalizeSourceOwnerRefs(row.sourceOwnerRefsJson),
  availability: row.availability as ReportAvailability,
  materializedAt: normalizeTimestamp(row.materializedAt, 'materializedAt'),
});

const normalizeIdentityContinuityReport = (row: QueryResultRow): IdentityContinuityReport => {
  const record = row as unknown as {
    reportRunId: string;
    sourceRefsJson: unknown;
    sourceOwnerRefsJson: unknown;
    availability: ReportAvailability;
    materializedAt: string | Date;
    runtimeMode: IdentityContinuityReport['runtimeMode'];
    currentTickRef: string | null;
    lastStableSnapshotRef: string | null;
    recentRecoveryRefsJson: unknown;
  };

  return {
    ...normalizeMaterializedIdentity({
      ...record,
      reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
    }),
    reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
    runtimeMode: record.runtimeMode,
    currentTickRef: record.currentTickRef ?? null,
    lastStableSnapshotRef: record.lastStableSnapshotRef ?? null,
    recentRecoveryRefs: normalizeStringArray(
      record.recentRecoveryRefsJson,
      'recentRecoveryRefsJson',
    ),
  };
};

const normalizeModelHealthReport = (row: QueryResultRow): ModelHealthReport => {
  const record = row as unknown as {
    reportRunId: string;
    sourceRefsJson: unknown;
    sourceOwnerRefsJson: unknown;
    availability: ReportAvailability;
    materializedAt: string | Date;
    organId: string;
    profileId: string | null;
    healthStatus: ModelHealthReport['healthStatus'];
    errorRate: number | string | null;
    fallbackRef: string | null;
    sourceSurfaceRefsJson: unknown;
  };

  return {
    ...normalizeMaterializedIdentity({
      ...record,
      reportFamily: REPORT_FAMILY.MODEL_HEALTH,
    }),
    reportFamily: REPORT_FAMILY.MODEL_HEALTH,
    organId: record.organId,
    profileId: record.profileId ?? null,
    healthStatus: record.healthStatus,
    errorRate: normalizeNullableNumber(record.errorRate),
    fallbackRef: record.fallbackRef ?? null,
    sourceSurfaceRefs: normalizeStringArray(record.sourceSurfaceRefsJson, 'sourceSurfaceRefsJson'),
  };
};

const normalizeStableSnapshotInventoryReport = (
  row: QueryResultRow,
): StableSnapshotInventoryReport => {
  const record = row as unknown as {
    reportRunId: string;
    sourceRefsJson: unknown;
    sourceOwnerRefsJson: unknown;
    availability: ReportAvailability;
    materializedAt: string | Date;
    latestStableSnapshotRef: string | null;
    totalSnapshots: number | string;
    snapshotsJson: unknown;
  };

  return {
    ...normalizeMaterializedIdentity({
      ...record,
      reportFamily: REPORT_FAMILY.STABLE_SNAPSHOT_INVENTORY,
    }),
    reportFamily: REPORT_FAMILY.STABLE_SNAPSHOT_INVENTORY,
    latestStableSnapshotRef: record.latestStableSnapshotRef ?? null,
    totalSnapshots: normalizeNumber(record.totalSnapshots, 'totalSnapshots'),
    snapshots: normalizeStableSnapshotEntries(record.snapshotsJson),
  };
};

const normalizeDevelopmentDiagnosticsReport = (
  row: QueryResultRow,
): DevelopmentDiagnosticsReport => {
  const record = row as unknown as {
    reportRunId: string;
    sourceRefsJson: unknown;
    sourceOwnerRefsJson: unknown;
    availability: ReportAvailability;
    materializedAt: string | Date;
    developmentFreezeActive: boolean;
    ledgerEntryCountLast30d: number | string;
    proposalCountLast30d: number | string;
    recentLedgerRefsJson: unknown;
    recentFailedActionRefsJson: unknown;
  };

  return {
    ...normalizeMaterializedIdentity({
      ...record,
      reportFamily: REPORT_FAMILY.DEVELOPMENT_DIAGNOSTICS,
    }),
    reportFamily: REPORT_FAMILY.DEVELOPMENT_DIAGNOSTICS,
    developmentFreezeActive: record.developmentFreezeActive,
    ledgerEntryCountLast30d: normalizeNumber(
      record.ledgerEntryCountLast30d,
      'ledgerEntryCountLast30d',
    ),
    proposalCountLast30d: normalizeNumber(record.proposalCountLast30d, 'proposalCountLast30d'),
    recentLedgerRefs: normalizeStringArray(record.recentLedgerRefsJson, 'recentLedgerRefsJson'),
    recentFailedActionRefs: normalizeStringArray(
      record.recentFailedActionRefsJson,
      'recentFailedActionRefsJson',
    ),
  };
};

const normalizeLifecycleDiagnosticsReport = (row: QueryResultRow): LifecycleDiagnosticsReport => {
  const record = row as unknown as {
    reportRunId: string;
    sourceRefsJson: unknown;
    sourceOwnerRefsJson: unknown;
    availability: ReportAvailability;
    materializedAt: string | Date;
    rollbackIncidentCountLast30d: number | string;
    gracefulShutdownCountLast30d: number | string;
    recentRollbackRefsJson: unknown;
    recentGracefulShutdownRefsJson: unknown;
    recentCompactionRefsJson: unknown;
  };

  return {
    ...normalizeMaterializedIdentity({
      ...record,
      reportFamily: REPORT_FAMILY.LIFECYCLE_DIAGNOSTICS,
    }),
    reportFamily: REPORT_FAMILY.LIFECYCLE_DIAGNOSTICS,
    rollbackIncidentCountLast30d: normalizeNumber(
      record.rollbackIncidentCountLast30d,
      'rollbackIncidentCountLast30d',
    ),
    gracefulShutdownCountLast30d: normalizeNumber(
      record.gracefulShutdownCountLast30d,
      'gracefulShutdownCountLast30d',
    ),
    recentRollbackRefs: normalizeStringArray(
      record.recentRollbackRefsJson,
      'recentRollbackRefsJson',
    ),
    recentGracefulShutdownRefs: normalizeStringArray(
      record.recentGracefulShutdownRefsJson,
      'recentGracefulShutdownRefsJson',
    ),
    recentCompactionRefs: normalizeStringArray(
      record.recentCompactionRefsJson,
      'recentCompactionRefsJson',
    ),
  };
};

const loadReportRunByFamilyAndSignature = async (
  db: ReportingDbExecutor,
  reportFamily: ReportFamily,
  sourceSnapshotSignature: string,
): Promise<ReportRunRow | null> => {
  const result = await db.query<ReportRunRow>(
    `select ${reportRunColumns}
     from ${reportRunsTable}
     where report_family = $1 and source_snapshot_signature = $2
     limit 1`,
    [reportFamily, sourceSnapshotSignature],
  );

  const row = result.rows[0];
  return row ? normalizeReportRunRow(row) : null;
};

const insertReportRun = async (
  db: ReportingDbExecutor,
  input: ReportRun,
): Promise<ReportRunRow | null> => {
  const result = await db.query<ReportRunRow>(
    `insert into ${reportRunsTable} (
       report_run_id,
       report_family,
       source_refs_json,
       source_owner_refs_json,
       source_snapshot_signature,
       materialized_at,
       availability_status,
       schema_version,
       publication_json
     )
     values ($1, $2, $3::jsonb, $4::jsonb, $5, $6::timestamptz, $7, $8, $9::jsonb)
     on conflict (report_family, source_snapshot_signature) do nothing
     returning ${reportRunColumns}`,
    [
      input.reportRunId,
      input.reportFamily,
      stableJson(input.sourceRefs),
      stableJson(input.sourceOwnerRefs),
      input.sourceSnapshotSignature,
      input.materializedAt,
      input.availabilityStatus,
      input.schemaVersion,
      stableJson(input.publication),
    ],
  );

  const row = result.rows[0];
  return row ? normalizeReportRunRow(row) : null;
};

const getReportRunById = async (
  db: ReportingDbExecutor,
  reportRunId: string,
): Promise<ReportRunRow | null> => {
  const result = await db.query<ReportRunRow>(
    `select ${reportRunColumns}
     from ${reportRunsTable}
     where report_run_id = $1
     limit 1`,
    [reportRunId],
  );

  const row = result.rows[0];
  return row ? normalizeReportRunRow(row) : null;
};

const getLatestReportRunByFamily = async (
  db: ReportingDbExecutor,
  reportFamily: ReportFamily,
): Promise<ReportRunRow | null> => {
  const result = await db.query<ReportRunRow>(
    `select ${reportRunColumns}
     from ${reportRunsTable}
     where report_family = $1
     order by materialized_at desc, report_run_id desc
     limit 1`,
    [reportFamily],
  );

  const row = result.rows[0];
  return row ? normalizeReportRunRow(row) : null;
};

const getIdentityContinuityReportByRun = async (
  db: ReportingDbExecutor,
  reportRunId: string,
): Promise<IdentityContinuityReport | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${identityContinuityColumns}
     from ${identityContinuityReportsTable} icr
     inner join ${reportRunsTable} rr on rr.report_run_id = icr.report_run_id
     where icr.report_run_id = $1
     limit 1`,
    [reportRunId],
  );

  const row = result.rows[0];
  return row ? normalizeIdentityContinuityReport(row) : null;
};

const getStableSnapshotInventoryReportByRun = async (
  db: ReportingDbExecutor,
  reportRunId: string,
): Promise<StableSnapshotInventoryReport | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${stableSnapshotInventoryColumns}
     from ${stableSnapshotInventoryReportsTable} ssir
     inner join ${reportRunsTable} rr on rr.report_run_id = ssir.report_run_id
     where ssir.report_run_id = $1
     limit 1`,
    [reportRunId],
  );

  const row = result.rows[0];
  return row ? normalizeStableSnapshotInventoryReport(row) : null;
};

const getDevelopmentDiagnosticsReportByRun = async (
  db: ReportingDbExecutor,
  reportRunId: string,
): Promise<DevelopmentDiagnosticsReport | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${developmentDiagnosticsColumns}
     from ${developmentDiagnosticsReportsTable} ddr
     inner join ${reportRunsTable} rr on rr.report_run_id = ddr.report_run_id
     where ddr.report_run_id = $1
     limit 1`,
    [reportRunId],
  );

  const row = result.rows[0];
  return row ? normalizeDevelopmentDiagnosticsReport(row) : null;
};

const getLifecycleDiagnosticsReportByRun = async (
  db: ReportingDbExecutor,
  reportRunId: string,
): Promise<LifecycleDiagnosticsReport | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${lifecycleDiagnosticsColumns}
     from ${lifecycleDiagnosticsReportsTable} ldr
     inner join ${reportRunsTable} rr on rr.report_run_id = ldr.report_run_id
     where ldr.report_run_id = $1
     limit 1`,
    [reportRunId],
  );

  const row = result.rows[0];
  return row ? normalizeLifecycleDiagnosticsReport(row) : null;
};

export const createReportingStore = (db: ReportingDbExecutor): ReportingStore => ({
  assertOwnedWriteSurface(surface: string): void {
    assertReportingOwnedWriteSurface(surface);
  },

  async recordReportRun(input: RecordReportRunInput): Promise<RecordReportRunResult> {
    for (const surface of input.requestedWriteSurfaces ?? []) {
      try {
        assertReportingOwnedWriteSurface(surface);
      } catch {
        return {
          accepted: false,
          reason: REPORTING_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED,
          rejectedWriteSurface: surface,
        };
      }
    }

    const normalizedInput = normalizeReportRunInput(input);
    assertValidReportRun(normalizedInput);

    const existing = await loadReportRunByFamilyAndSignature(
      db,
      normalizedInput.reportFamily,
      normalizedInput.sourceSnapshotSignature,
    );
    if (existing) {
      return { accepted: true, deduplicated: true, reportRun: existing };
    }

    const inserted = await insertReportRun(db, normalizedInput);
    if (inserted) {
      return { accepted: true, deduplicated: false, reportRun: inserted };
    }

    const raced = await loadReportRunByFamilyAndSignature(
      db,
      normalizedInput.reportFamily,
      normalizedInput.sourceSnapshotSignature,
    );
    if (!raced) {
      throw new Error('report run insert raced without durable row');
    }

    return { accepted: true, deduplicated: true, reportRun: raced };
  },

  getReportRun(reportRunId: string): Promise<ReportRunRow | null> {
    return getReportRunById(db, reportRunId);
  },

  getLatestReportRun(reportFamily: ReportFamily): Promise<ReportRunRow | null> {
    return getLatestReportRunByFamily(db, reportFamily);
  },

  async updateReportPublication(input: UpdateReportPublicationInput): Promise<ReportRunRow> {
    assertValidReportPublicationMetadata(input.publication);

    const result = await db.query<ReportRunRow>(
      `update ${reportRunsTable}
       set publication_json = $2::jsonb
       where report_run_id = $1
       returning ${reportRunColumns}`,
      [input.reportRunId, stableJson(input.publication)],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`report run ${input.reportRunId} was not found`);
    }

    return normalizeReportRunRow(row);
  },

  async listReportRuns(input?: ListReportRunsInput): Promise<ReportRunRow[]> {
    const limit = Math.max(1, Math.min(input?.limit ?? 20, 100));
    const result = input?.reportFamily
      ? await db.query<ReportRunRow>(
          `select ${reportRunColumns}
           from ${reportRunsTable}
           where report_family = $1
           order by materialized_at desc, report_run_id desc
           limit $2`,
          [input.reportFamily, limit],
        )
      : await db.query<ReportRunRow>(
          `select ${reportRunColumns}
           from ${reportRunsTable}
           order by materialized_at desc, report_run_id desc
           limit $1`,
          [limit],
        );

    return result.rows.map(normalizeReportRunRow);
  },

  async upsertIdentityContinuityReport(
    report: IdentityContinuityReport,
  ): Promise<IdentityContinuityReport> {
    await db.query(
      `insert into ${identityContinuityReportsTable} (
         report_run_id,
         runtime_mode,
         current_tick_ref,
         last_stable_snapshot_ref,
         recent_recovery_refs_json,
         availability_status,
         materialized_at
       ) values (
         $1, $2, $3, $4, $5::jsonb, $6, $7::timestamptz
       )
       on conflict (report_run_id) do update
         set runtime_mode = excluded.runtime_mode,
             current_tick_ref = excluded.current_tick_ref,
             last_stable_snapshot_ref = excluded.last_stable_snapshot_ref,
             recent_recovery_refs_json = excluded.recent_recovery_refs_json,
             availability_status = excluded.availability_status,
             materialized_at = excluded.materialized_at
      `,
      [
        report.reportRunId,
        report.runtimeMode,
        report.currentTickRef,
        report.lastStableSnapshotRef,
        stableJson(report.recentRecoveryRefs),
        report.availability,
        report.materializedAt,
      ],
    );

    const stored = await getIdentityContinuityReportByRun(db, report.reportRunId);
    if (!stored) {
      throw new Error(`failed to load identity continuity report ${report.reportRunId}`);
    }

    return stored;
  },

  getIdentityContinuityReport(reportRunId: string): Promise<IdentityContinuityReport | null> {
    return getIdentityContinuityReportByRun(db, reportRunId);
  },

  async getLatestIdentityContinuityReport(): Promise<IdentityContinuityReport | null> {
    const reportRun = await getLatestReportRunByFamily(db, REPORT_FAMILY.IDENTITY_CONTINUITY);
    return reportRun ? await getIdentityContinuityReportByRun(db, reportRun.reportRunId) : null;
  },

  async replaceModelHealthReports(
    input: ReplaceModelHealthReportsInput,
  ): Promise<ModelHealthReport[]> {
    const result = await db.query<QueryResultRow>(
      `with cleared as (
         delete from ${modelHealthReportsTable}
         where report_run_id = $1
       ),
       incoming as (
         select *
         from jsonb_to_recordset($2::jsonb) as payload(
           report_run_id text,
           organ_id text,
           profile_id text,
           health_status text,
           error_rate double precision,
           fallback_ref text,
           source_surface_refs_json jsonb,
           availability_status text,
           materialized_at timestamptz
         )
       ),
       inserted as (
         insert into ${modelHealthReportsTable} (
           report_row_id,
           report_run_id,
           organ_id,
           profile_id,
           health_status,
           error_rate,
           fallback_ref,
           source_surface_refs_json,
           availability_status,
           materialized_at
         )
         select
           report_run_id || ':' || organ_id || ':' || coalesce(profile_id, 'none'),
           report_run_id,
           organ_id,
           profile_id,
           health_status,
           error_rate,
           fallback_ref,
           source_surface_refs_json,
           availability_status,
           materialized_at
         from incoming
       )
       select ${modelHealthColumns}
       from ${modelHealthReportsTable} mhr
       inner join ${reportRunsTable} rr on rr.report_run_id = mhr.report_run_id
       where mhr.report_run_id = $1
       order by mhr.organ_id asc, mhr.profile_id asc nulls first`,
      [
        input.reportRunId,
        stableJson(
          input.reports.map((report) => ({
            report_run_id: input.reportRunId,
            organ_id: report.organId,
            profile_id: report.profileId,
            health_status: report.healthStatus,
            error_rate: report.errorRate,
            fallback_ref: report.fallbackRef,
            source_surface_refs_json: report.sourceSurfaceRefs,
            availability_status: report.availability,
            materialized_at: report.materializedAt,
          })),
        ),
      ],
    );

    return result.rows.map(normalizeModelHealthReport);
  },

  async listModelHealthReports(
    input: ListModelHealthReportsInput = {},
  ): Promise<ModelHealthReport[]> {
    const reportRunId =
      input.latest || !input.reportRunId
        ? ((await getLatestReportRunByFamily(db, REPORT_FAMILY.MODEL_HEALTH))?.reportRunId ?? null)
        : input.reportRunId;

    if (!reportRunId) {
      return [];
    }

    const result = await db.query<QueryResultRow>(
      `select ${modelHealthColumns}
       from ${modelHealthReportsTable} mhr
       inner join ${reportRunsTable} rr on rr.report_run_id = mhr.report_run_id
       where mhr.report_run_id = $1
       order by mhr.organ_id asc, mhr.profile_id asc nulls first`,
      [reportRunId],
    );

    return result.rows.map(normalizeModelHealthReport);
  },

  async upsertStableSnapshotInventoryReport(
    report: StableSnapshotInventoryReport,
  ): Promise<StableSnapshotInventoryReport> {
    await db.query(
      `insert into ${stableSnapshotInventoryReportsTable} (
         report_run_id,
         latest_stable_snapshot_ref,
         total_snapshots,
         snapshots_json,
         availability_status,
         materialized_at
       ) values (
         $1, $2, $3, $4::jsonb, $5, $6::timestamptz
       )
       on conflict (report_run_id) do update
         set latest_stable_snapshot_ref = excluded.latest_stable_snapshot_ref,
             total_snapshots = excluded.total_snapshots,
             snapshots_json = excluded.snapshots_json,
             availability_status = excluded.availability_status,
             materialized_at = excluded.materialized_at
      `,
      [
        report.reportRunId,
        report.latestStableSnapshotRef,
        report.totalSnapshots,
        stableJson(report.snapshots),
        report.availability,
        report.materializedAt,
      ],
    );

    const stored = await getStableSnapshotInventoryReportByRun(db, report.reportRunId);
    if (!stored) {
      throw new Error(`failed to load stable snapshot inventory ${report.reportRunId}`);
    }

    return stored;
  },

  getStableSnapshotInventoryReport(
    reportRunId: string,
  ): Promise<StableSnapshotInventoryReport | null> {
    return getStableSnapshotInventoryReportByRun(db, reportRunId);
  },

  async getLatestStableSnapshotInventoryReport(): Promise<StableSnapshotInventoryReport | null> {
    const reportRun = await getLatestReportRunByFamily(db, REPORT_FAMILY.STABLE_SNAPSHOT_INVENTORY);
    return reportRun
      ? await getStableSnapshotInventoryReportByRun(db, reportRun.reportRunId)
      : null;
  },

  async upsertDevelopmentDiagnosticsReport(
    report: DevelopmentDiagnosticsReport,
  ): Promise<DevelopmentDiagnosticsReport> {
    await db.query(
      `insert into ${developmentDiagnosticsReportsTable} (
         report_run_id,
         development_freeze_active,
         ledger_entry_count_last_30d,
         proposal_count_last_30d,
         recent_ledger_refs_json,
         recent_failed_action_refs_json,
         availability_status,
         materialized_at
       ) values (
         $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::timestamptz
       )
       on conflict (report_run_id) do update
         set development_freeze_active = excluded.development_freeze_active,
             ledger_entry_count_last_30d = excluded.ledger_entry_count_last_30d,
             proposal_count_last_30d = excluded.proposal_count_last_30d,
             recent_ledger_refs_json = excluded.recent_ledger_refs_json,
             recent_failed_action_refs_json = excluded.recent_failed_action_refs_json,
             availability_status = excluded.availability_status,
             materialized_at = excluded.materialized_at
      `,
      [
        report.reportRunId,
        report.developmentFreezeActive,
        report.ledgerEntryCountLast30d,
        report.proposalCountLast30d,
        stableJson(report.recentLedgerRefs),
        stableJson(report.recentFailedActionRefs),
        report.availability,
        report.materializedAt,
      ],
    );

    const stored = await getDevelopmentDiagnosticsReportByRun(db, report.reportRunId);
    if (!stored) {
      throw new Error(`failed to load development diagnostics ${report.reportRunId}`);
    }

    return stored;
  },

  getDevelopmentDiagnosticsReport(
    reportRunId: string,
  ): Promise<DevelopmentDiagnosticsReport | null> {
    return getDevelopmentDiagnosticsReportByRun(db, reportRunId);
  },

  async getLatestDevelopmentDiagnosticsReport(): Promise<DevelopmentDiagnosticsReport | null> {
    const reportRun = await getLatestReportRunByFamily(db, REPORT_FAMILY.DEVELOPMENT_DIAGNOSTICS);
    return reportRun ? await getDevelopmentDiagnosticsReportByRun(db, reportRun.reportRunId) : null;
  },

  async upsertLifecycleDiagnosticsReport(
    report: LifecycleDiagnosticsReport,
  ): Promise<LifecycleDiagnosticsReport> {
    await db.query(
      `insert into ${lifecycleDiagnosticsReportsTable} (
         report_run_id,
         rollback_incident_count_last_30d,
         graceful_shutdown_count_last_30d,
         recent_rollback_refs_json,
         recent_graceful_shutdown_refs_json,
         recent_compaction_refs_json,
         availability_status,
         materialized_at
       ) values (
         $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8::timestamptz
       )
       on conflict (report_run_id) do update
         set rollback_incident_count_last_30d = excluded.rollback_incident_count_last_30d,
             graceful_shutdown_count_last_30d = excluded.graceful_shutdown_count_last_30d,
             recent_rollback_refs_json = excluded.recent_rollback_refs_json,
             recent_graceful_shutdown_refs_json = excluded.recent_graceful_shutdown_refs_json,
             recent_compaction_refs_json = excluded.recent_compaction_refs_json,
             availability_status = excluded.availability_status,
             materialized_at = excluded.materialized_at
      `,
      [
        report.reportRunId,
        report.rollbackIncidentCountLast30d,
        report.gracefulShutdownCountLast30d,
        stableJson(report.recentRollbackRefs),
        stableJson(report.recentGracefulShutdownRefs),
        stableJson(report.recentCompactionRefs),
        report.availability,
        report.materializedAt,
      ],
    );

    const stored = await getLifecycleDiagnosticsReportByRun(db, report.reportRunId);
    if (!stored) {
      throw new Error(`failed to load lifecycle diagnostics ${report.reportRunId}`);
    }

    return stored;
  },

  getLifecycleDiagnosticsReport(reportRunId: string): Promise<LifecycleDiagnosticsReport | null> {
    return getLifecycleDiagnosticsReportByRun(db, reportRunId);
  },

  async getLatestLifecycleDiagnosticsReport(): Promise<LifecycleDiagnosticsReport | null> {
    const reportRun = await getLatestReportRunByFamily(db, REPORT_FAMILY.LIFECYCLE_DIAGNOSTICS);
    return reportRun ? await getLifecycleDiagnosticsReportByRun(db, reportRun.reportRunId) : null;
  },

  async loadOrganErrorRateSource(): Promise<OrganErrorRateSource | null> {
    const reportRun = await getLatestReportRunByFamily(db, REPORT_FAMILY.MODEL_HEALTH);
    if (!reportRun || reportRun.availabilityStatus === REPORT_AVAILABILITY.UNAVAILABLE) {
      return null;
    }

    const reports = await this.listModelHealthReports({ reportRunId: reportRun.reportRunId });
    const numericRows = reports.filter(
      (report) =>
        report.errorRate != null &&
        report.availability !== REPORT_AVAILABILITY.UNAVAILABLE &&
        report.healthStatus !== 'unavailable',
    );
    if (numericRows.length === 0) {
      return null;
    }

    return {
      reportRunId: reportRun.reportRunId,
      materializedAt: reportRun.materializedAt,
      availability: reportRun.availabilityStatus,
      metricValue: Math.max(...numericRows.map((report) => report.errorRate ?? 0)),
      evidenceRefs: Array.from(
        new Set(
          numericRows.map((report) => `report:model_health:${report.profileId ?? report.organId}`),
        ),
      ).sort(),
    };
  },
});
