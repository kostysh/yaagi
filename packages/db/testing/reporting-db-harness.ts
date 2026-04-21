import type {
  DevelopmentDiagnosticsReport,
  IdentityContinuityReport,
  LifecycleDiagnosticsReport,
  ModelHealthReport,
  StableSnapshotInventoryReport,
} from '@yaagi/contracts/reporting';
import type { ReportingDbExecutor, ReportRunRow } from '../src/reporting.ts';

type HarnessState = {
  reportRuns: ReportRunRow[];
  identityContinuityReports: IdentityContinuityReport[];
  modelHealthReports: ModelHealthReport[];
  stableSnapshotInventoryReports: StableSnapshotInventoryReport[];
  developmentDiagnosticsReports: DevelopmentDiagnosticsReport[];
  lifecycleDiagnosticsReports: LifecycleDiagnosticsReport[];
};

const parseJson = <T>(value: unknown): T => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
};

const normalizeSql = (sqlText: string): string => sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

const cloneState = (state: HarnessState): HarnessState => structuredClone(state);

const sortReportRuns = (rows: ReportRunRow[]): ReportRunRow[] =>
  [...rows].sort(
    (left, right) =>
      right.materializedAt.localeCompare(left.materializedAt) ||
      right.reportRunId.localeCompare(left.reportRunId),
  );

const replaceState = (target: HarnessState, next: HarnessState): void => {
  target.reportRuns = next.reportRuns;
  target.identityContinuityReports = next.identityContinuityReports;
  target.modelHealthReports = next.modelHealthReports;
  target.stableSnapshotInventoryReports = next.stableSnapshotInventoryReports;
  target.developmentDiagnosticsReports = next.developmentDiagnosticsReports;
  target.lifecycleDiagnosticsReports = next.lifecycleDiagnosticsReports;
};

const findReportRun = (state: HarnessState, reportRunId: string): ReportRunRow => {
  const reportRun = state.reportRuns.find((row) => row.reportRunId === reportRunId);
  if (!reportRun) {
    throw new Error(`report run ${reportRunId} was not seeded in reporting harness`);
  }

  return reportRun;
};

const toIdentityRow = (
  state: HarnessState,
  report: IdentityContinuityReport,
): Record<string, unknown> => {
  const reportRun = findReportRun(state, report.reportRunId);
  return {
    reportRunId: report.reportRunId,
    sourceRefsJson: reportRun.sourceRefsJson,
    sourceOwnerRefsJson: reportRun.sourceOwnerRefsJson,
    availability: report.availability,
    materializedAt: report.materializedAt,
    runtimeMode: report.runtimeMode,
    currentTickRef: report.currentTickRef,
    lastStableSnapshotRef: report.lastStableSnapshotRef,
    recentRecoveryRefsJson: report.recentRecoveryRefs,
  };
};

const toModelRow = (state: HarnessState, report: ModelHealthReport): Record<string, unknown> => {
  const reportRun = findReportRun(state, report.reportRunId);
  return {
    reportRunId: report.reportRunId,
    sourceRefsJson: reportRun.sourceRefsJson,
    sourceOwnerRefsJson: reportRun.sourceOwnerRefsJson,
    availability: report.availability,
    materializedAt: report.materializedAt,
    organId: report.organId,
    profileId: report.profileId,
    healthStatus: report.healthStatus,
    errorRate: report.errorRate,
    fallbackRef: report.fallbackRef,
    sourceSurfaceRefsJson: report.sourceSurfaceRefs,
  };
};

const toStableSnapshotRow = (
  state: HarnessState,
  report: StableSnapshotInventoryReport,
): Record<string, unknown> => {
  const reportRun = findReportRun(state, report.reportRunId);
  return {
    reportRunId: report.reportRunId,
    sourceRefsJson: reportRun.sourceRefsJson,
    sourceOwnerRefsJson: reportRun.sourceOwnerRefsJson,
    availability: report.availability,
    materializedAt: report.materializedAt,
    latestStableSnapshotRef: report.latestStableSnapshotRef,
    totalSnapshots: report.totalSnapshots,
    snapshotsJson: report.snapshots,
  };
};

const toDevelopmentRow = (
  state: HarnessState,
  report: DevelopmentDiagnosticsReport,
): Record<string, unknown> => {
  const reportRun = findReportRun(state, report.reportRunId);
  return {
    reportRunId: report.reportRunId,
    sourceRefsJson: reportRun.sourceRefsJson,
    sourceOwnerRefsJson: reportRun.sourceOwnerRefsJson,
    availability: report.availability,
    materializedAt: report.materializedAt,
    developmentFreezeActive: report.developmentFreezeActive,
    ledgerEntryCountLast30d: report.ledgerEntryCountLast30d,
    proposalCountLast30d: report.proposalCountLast30d,
    recentLedgerRefsJson: report.recentLedgerRefs,
    recentFailedActionRefsJson: report.recentFailedActionRefs,
  };
};

const toLifecycleRow = (
  state: HarnessState,
  report: LifecycleDiagnosticsReport,
): Record<string, unknown> => {
  const reportRun = findReportRun(state, report.reportRunId);
  return {
    reportRunId: report.reportRunId,
    sourceRefsJson: reportRun.sourceRefsJson,
    sourceOwnerRefsJson: reportRun.sourceOwnerRefsJson,
    availability: report.availability,
    materializedAt: report.materializedAt,
    rollbackIncidentCountLast30d: report.rollbackIncidentCountLast30d,
    gracefulShutdownCountLast30d: report.gracefulShutdownCountLast30d,
    recentRollbackRefsJson: report.recentRollbackRefs,
    recentGracefulShutdownRefsJson: report.recentGracefulShutdownRefs,
    recentCompactionRefsJson: report.recentCompactionRefs,
  };
};

export const createReportingDbHarness = (): {
  db: ReportingDbExecutor;
  state: HarnessState;
  queries: string[];
} => {
  const state: HarnessState = {
    reportRuns: [],
    identityContinuityReports: [],
    modelHealthReports: [],
    stableSnapshotInventoryReports: [],
    developmentDiagnosticsReports: [],
    lifecycleDiagnosticsReports: [],
  };
  const queries: string[] = [];
  let transactionBackup: HarnessState | null = null;

  const query = (async (sqlText: unknown, params: unknown[] = []) => {
    await Promise.resolve();
    if (typeof sqlText !== 'string') {
      throw new Error('reporting db harness supports only text queries');
    }

    queries.push(sqlText);
    const sql = normalizeSql(sqlText);

    if (sql === 'begin') {
      transactionBackup = cloneState(state);
      return { rows: [] };
    }

    if (sql === 'commit') {
      transactionBackup = null;
      return { rows: [] };
    }

    if (sql === 'rollback') {
      if (transactionBackup) {
        replaceState(state, cloneState(transactionBackup));
      }
      transactionBackup = null;
      return { rows: [] };
    }

    if (
      sql.includes('from polyphony_runtime.report_runs') &&
      sql.includes('where report_family = $1 and source_snapshot_signature = $2')
    ) {
      const row = state.reportRuns.find(
        (entry) => entry.reportFamily === params[0] && entry.sourceSnapshotSignature === params[1],
      );
      return { rows: row ? [row] : [] };
    }

    if (sql.startsWith('insert into polyphony_runtime.report_runs')) {
      const existing = state.reportRuns.find(
        (entry) => entry.reportFamily === params[1] && entry.sourceSnapshotSignature === params[4],
      );
      if (existing) {
        return { rows: [] };
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
      state.reportRuns.push(row);
      return { rows: [row] };
    }

    if (
      sql.includes('from polyphony_runtime.report_runs') &&
      sql.includes('where report_run_id = $1') &&
      sql.includes('limit 1')
    ) {
      const row = state.reportRuns.find((entry) => entry.reportRunId === params[0]);
      return { rows: row ? [row] : [] };
    }

    if (
      sql.includes('from polyphony_runtime.report_runs') &&
      sql.includes('where report_family = $1') &&
      sql.includes('order by materialized_at desc') &&
      sql.includes('limit 1')
    ) {
      const [row] = sortReportRuns(
        state.reportRuns.filter((entry) => entry.reportFamily === params[0]),
      );
      return { rows: row ? [row] : [] };
    }

    if (
      sql.startsWith('update polyphony_runtime.report_runs') &&
      sql.includes('set publication_json = $2::jsonb')
    ) {
      const row = state.reportRuns.find((entry) => entry.reportRunId === params[0]);
      if (!row) {
        return { rows: [] };
      }
      row.publicationJson = parseJson<ReportRunRow['publicationJson']>(params[1]);
      return { rows: [row] };
    }

    if (
      sql.includes('from polyphony_runtime.report_runs') &&
      sql.includes('where report_family = $1') &&
      sql.includes('limit $2')
    ) {
      return {
        rows: sortReportRuns(
          state.reportRuns.filter((entry) => entry.reportFamily === params[0]),
        ).slice(0, Number(params[1])),
      };
    }

    if (
      sql.includes('from polyphony_runtime.report_runs') &&
      sql.includes('order by materialized_at desc') &&
      sql.includes('limit $1')
    ) {
      return {
        rows: sortReportRuns(state.reportRuns).slice(0, Number(params[0])),
      };
    }

    if (sql.startsWith('insert into polyphony_runtime.identity_continuity_reports')) {
      const report: IdentityContinuityReport = {
        reportRunId: params[0] as string,
        reportFamily: 'identity_continuity',
        sourceRefs: findReportRun(state, params[0] as string).sourceRefsJson,
        sourceOwnerRefs: findReportRun(state, params[0] as string).sourceOwnerRefsJson,
        availability: params[5] as IdentityContinuityReport['availability'],
        materializedAt: params[6] as string,
        runtimeMode: params[1] as IdentityContinuityReport['runtimeMode'],
        currentTickRef: (params[2] as string | null) ?? null,
        lastStableSnapshotRef: (params[3] as string | null) ?? null,
        recentRecoveryRefs: parseJson<string[]>(params[4]),
      };
      state.identityContinuityReports = [
        ...state.identityContinuityReports.filter(
          (entry) => entry.reportRunId !== report.reportRunId,
        ),
        report,
      ];
      return { rows: [toIdentityRow(state, report)] };
    }

    if (
      sql.includes('from polyphony_runtime.identity_continuity_reports icr') &&
      sql.includes('where icr.report_run_id = $1')
    ) {
      const report = state.identityContinuityReports.find(
        (entry) => entry.reportRunId === params[0],
      );
      return { rows: report ? [toIdentityRow(state, report)] : [] };
    }

    if (
      sql.includes('jsonb_to_recordset($2::jsonb)') &&
      sql.includes('insert into polyphony_runtime.model_health_reports')
    ) {
      state.modelHealthReports = state.modelHealthReports.filter(
        (entry) => entry.reportRunId !== params[0],
      );

      const incoming = parseJson<
        Array<{
          report_run_id: string;
          organ_id: string;
          profile_id: string | null;
          health_status: ModelHealthReport['healthStatus'];
          error_rate: number | null;
          fallback_ref: string | null;
          source_surface_refs_json: string[];
          availability_status: ModelHealthReport['availability'];
          materialized_at: string;
        }>
      >(params[1]);

      for (const row of incoming) {
        state.modelHealthReports.push({
          reportRunId: row.report_run_id,
          reportFamily: 'model_health',
          sourceRefs: findReportRun(state, row.report_run_id).sourceRefsJson,
          sourceOwnerRefs: findReportRun(state, row.report_run_id).sourceOwnerRefsJson,
          availability: row.availability_status,
          materializedAt: row.materialized_at,
          organId: row.organ_id,
          profileId: row.profile_id,
          healthStatus: row.health_status,
          errorRate: row.error_rate,
          fallbackRef: row.fallback_ref,
          sourceSurfaceRefs: row.source_surface_refs_json,
        });
      }

      return {
        rows: state.modelHealthReports
          .filter((entry) => entry.reportRunId === params[0])
          .sort(
            (left, right) =>
              left.organId.localeCompare(right.organId) ||
              (left.profileId ?? '').localeCompare(right.profileId ?? ''),
          )
          .map((entry) => toModelRow(state, entry)),
      };
    }

    if (
      sql.includes('from polyphony_runtime.model_health_reports mhr') &&
      sql.includes('where mhr.report_run_id = $1')
    ) {
      return {
        rows: state.modelHealthReports
          .filter((entry) => entry.reportRunId === params[0])
          .sort(
            (left, right) =>
              left.organId.localeCompare(right.organId) ||
              (left.profileId ?? '').localeCompare(right.profileId ?? ''),
          )
          .map((entry) => toModelRow(state, entry)),
      };
    }

    if (sql.startsWith('insert into polyphony_runtime.stable_snapshot_inventory_reports')) {
      const report: StableSnapshotInventoryReport = {
        reportRunId: params[0] as string,
        reportFamily: 'stable_snapshot_inventory',
        sourceRefs: findReportRun(state, params[0] as string).sourceRefsJson,
        sourceOwnerRefs: findReportRun(state, params[0] as string).sourceOwnerRefsJson,
        availability: params[4] as StableSnapshotInventoryReport['availability'],
        materializedAt: params[5] as string,
        latestStableSnapshotRef: (params[1] as string | null) ?? null,
        totalSnapshots: Number(params[2]),
        snapshots: parseJson<StableSnapshotInventoryReport['snapshots']>(params[3]),
      };
      state.stableSnapshotInventoryReports = [
        ...state.stableSnapshotInventoryReports.filter(
          (entry) => entry.reportRunId !== report.reportRunId,
        ),
        report,
      ];
      return { rows: [toStableSnapshotRow(state, report)] };
    }

    if (
      sql.includes('from polyphony_runtime.stable_snapshot_inventory_reports ssir') &&
      sql.includes('where ssir.report_run_id = $1')
    ) {
      const report = state.stableSnapshotInventoryReports.find(
        (entry) => entry.reportRunId === params[0],
      );
      return { rows: report ? [toStableSnapshotRow(state, report)] : [] };
    }

    if (sql.startsWith('insert into polyphony_runtime.development_diagnostics_reports')) {
      const report: DevelopmentDiagnosticsReport = {
        reportRunId: params[0] as string,
        reportFamily: 'development_diagnostics',
        sourceRefs: findReportRun(state, params[0] as string).sourceRefsJson,
        sourceOwnerRefs: findReportRun(state, params[0] as string).sourceOwnerRefsJson,
        availability: params[6] as DevelopmentDiagnosticsReport['availability'],
        materializedAt: params[7] as string,
        developmentFreezeActive: Boolean(params[1]),
        ledgerEntryCountLast30d: Number(params[2]),
        proposalCountLast30d: Number(params[3]),
        recentLedgerRefs: parseJson<string[]>(params[4]),
        recentFailedActionRefs: parseJson<string[]>(params[5]),
      };
      state.developmentDiagnosticsReports = [
        ...state.developmentDiagnosticsReports.filter(
          (entry) => entry.reportRunId !== report.reportRunId,
        ),
        report,
      ];
      return { rows: [toDevelopmentRow(state, report)] };
    }

    if (
      sql.includes('from polyphony_runtime.development_diagnostics_reports ddr') &&
      sql.includes('where ddr.report_run_id = $1')
    ) {
      const report = state.developmentDiagnosticsReports.find(
        (entry) => entry.reportRunId === params[0],
      );
      return { rows: report ? [toDevelopmentRow(state, report)] : [] };
    }

    if (sql.startsWith('insert into polyphony_runtime.lifecycle_diagnostics_reports')) {
      const report: LifecycleDiagnosticsReport = {
        reportRunId: params[0] as string,
        reportFamily: 'lifecycle_diagnostics',
        sourceRefs: findReportRun(state, params[0] as string).sourceRefsJson,
        sourceOwnerRefs: findReportRun(state, params[0] as string).sourceOwnerRefsJson,
        availability: params[6] as LifecycleDiagnosticsReport['availability'],
        materializedAt: params[7] as string,
        rollbackIncidentCountLast30d: Number(params[1]),
        gracefulShutdownCountLast30d: Number(params[2]),
        recentRollbackRefs: parseJson<string[]>(params[3]),
        recentGracefulShutdownRefs: parseJson<string[]>(params[4]),
        recentCompactionRefs: parseJson<string[]>(params[5]),
      };
      state.lifecycleDiagnosticsReports = [
        ...state.lifecycleDiagnosticsReports.filter(
          (entry) => entry.reportRunId !== report.reportRunId,
        ),
        report,
      ];
      return { rows: [toLifecycleRow(state, report)] };
    }

    if (
      sql.includes('from polyphony_runtime.lifecycle_diagnostics_reports ldr') &&
      sql.includes('where ldr.report_run_id = $1')
    ) {
      const report = state.lifecycleDiagnosticsReports.find(
        (entry) => entry.reportRunId === params[0],
      );
      return { rows: report ? [toLifecycleRow(state, report)] : [] };
    }

    throw new Error(`unsupported sql in reporting db harness: ${sqlText}`);
  }) as ReportingDbExecutor['query'];

  return {
    db: { query } as ReportingDbExecutor,
    state,
    queries,
  };
};
