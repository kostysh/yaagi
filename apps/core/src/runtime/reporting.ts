import { createHash, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import {
  BASELINE_MODEL_PROFILE_ROLE,
  RICHER_MODEL_PROFILE_ROLE,
  createExpandedModelEcologyStore,
  createReportingStore,
  createRuntimeDbClient,
  createRuntimeModelProfileStore,
  createTickRuntimeStore,
  type ReportingDbExecutor,
  type ReportRunRow,
} from '@yaagi/db';
import {
  REPORT_AVAILABILITY,
  REPORT_FAMILY,
  REPORT_PUBLICATION_CHANNEL,
  REPORT_PUBLICATION_STATUS,
  REPORT_SOURCE_OWNER,
  type DevelopmentDiagnosticsReport,
  type IdentityContinuityReport,
  type LifecycleDiagnosticsReport,
  type ModelHealthReport,
  type OrganErrorRateSource,
  type ReportAvailability,
  type ReportFamily,
  type ReportPublicationChannel,
  type ReportPublicationMetadata,
  type ReportSourceOwner,
  type StableSnapshotInventoryEntry,
  type StableSnapshotInventoryReport,
} from '@yaagi/contracts/reporting';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';

type ReportingSource<TReport> = {
  availability: ReportAvailability;
  sourceRefs: string[];
  sourceOwnerRefs: ReportSourceOwner[];
  report: TReport;
  signaturePayload: unknown;
};

type ReportingSourceLoaders = {
  loadIdentityContinuitySource(input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Pick<
        IdentityContinuityReport,
        'runtimeMode' | 'currentTickRef' | 'lastStableSnapshotRef' | 'recentRecoveryRefs'
      >
    >
  >;
  loadModelHealthSource(input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Array<
        Pick<
          ModelHealthReport,
          | 'organId'
          | 'profileId'
          | 'healthStatus'
          | 'errorRate'
          | 'fallbackRef'
          | 'sourceSurfaceRefs'
        > & { availability: ReportAvailability }
      >
    >
  >;
  loadStableSnapshotInventorySource(input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Pick<
        StableSnapshotInventoryReport,
        'latestStableSnapshotRef' | 'totalSnapshots' | 'snapshots'
      >
    >
  >;
  loadDevelopmentDiagnosticsSource(input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Pick<
        DevelopmentDiagnosticsReport,
        | 'developmentFreezeActive'
        | 'ledgerEntryCountLast30d'
        | 'proposalCountLast30d'
        | 'recentLedgerRefs'
        | 'recentFailedActionRefs'
      >
    >
  >;
  loadLifecycleDiagnosticsSource(input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Pick<
        LifecycleDiagnosticsReport,
        | 'rollbackIncidentCountLast30d'
        | 'gracefulShutdownCountLast30d'
        | 'recentRollbackRefs'
        | 'recentGracefulShutdownRefs'
        | 'recentCompactionRefs'
      >
    >
  >;
};

export type ReportingBundle = {
  generatedAt: string;
  reportRuns: {
    identityContinuity: ReportRunRow | null;
    modelHealth: ReportRunRow | null;
    stableSnapshotInventory: ReportRunRow | null;
    developmentDiagnostics: ReportRunRow | null;
    lifecycleDiagnostics: ReportRunRow | null;
  };
  reports: {
    identityContinuity: IdentityContinuityReport | null;
    modelHealth: ModelHealthReport[];
    stableSnapshotInventory: StableSnapshotInventoryReport | null;
    developmentDiagnostics: DevelopmentDiagnosticsReport | null;
    lifecycleDiagnostics: LifecycleDiagnosticsReport | null;
  };
};

export type PublishReportArtifactInput = {
  reportRunId: string;
  reportFamily: ReportFamily;
  channel: ReportPublicationChannel;
  ref: string;
  detail?: string | null;
  publishedAt?: string;
  status?: typeof REPORT_PUBLICATION_STATUS.PUBLISHED | typeof REPORT_PUBLICATION_STATUS.FAILED;
};

export type ReportingService = {
  materializeIdentityContinuityReport(): Promise<IdentityContinuityReport>;
  materializeModelHealthReports(): Promise<ModelHealthReport[]>;
  materializeStableSnapshotInventoryReport(): Promise<StableSnapshotInventoryReport>;
  materializeDevelopmentDiagnosticsReport(): Promise<DevelopmentDiagnosticsReport>;
  materializeLifecycleDiagnosticsReport(): Promise<LifecycleDiagnosticsReport>;
  materializeAllReportFamilies(): Promise<ReportingBundle>;
  getIdentityContinuityReport(): Promise<IdentityContinuityReport>;
  getModelHealthReports(): Promise<ModelHealthReport[]>;
  getStableSnapshotInventoryReport(): Promise<StableSnapshotInventoryReport>;
  getDevelopmentDiagnosticsReport(): Promise<DevelopmentDiagnosticsReport>;
  getLifecycleDiagnosticsReport(): Promise<LifecycleDiagnosticsReport>;
  loadOrganErrorRateSource(): Promise<OrganErrorRateSource | null>;
  publishReportArtifact(input: PublishReportArtifactInput): Promise<ReportRunRow>;
  getReportingBundle(): Promise<ReportingBundle>;
};

type ReportingServiceOptions = ReportingSourceLoaders & {
  store: ReturnType<typeof createReportingStore>;
  now?: () => Date;
  createId?: () => string;
  schemaVersion?: string;
};

type MaterializedModelHealthFamily = {
  reportRun: ReportRunRow;
  reports: ModelHealthReport[];
};

const REPORTING_SCHEMA_VERSION = '019_reporting_foundation.sql';
const MODEL_HEALTH_MISSING_SOURCE_REFS = ['model_health:none'];
const MODEL_HEALTH_MISSING_SOURCE_OWNERS: ReportSourceOwner[] = [
  REPORT_SOURCE_OWNER.BASELINE_MODEL_ROUTING,
  REPORT_SOURCE_OWNER.EXPANDED_MODEL_ECOLOGY,
];

const defaultPublicationMetadata = (): ReportPublicationMetadata => ({
  [REPORT_PUBLICATION_CHANNEL.METRICS]: {
    status: REPORT_PUBLICATION_STATUS.NOT_REQUESTED,
    publishedAt: null,
    ref: null,
    detail: null,
  },
  [REPORT_PUBLICATION_CHANNEL.LOGS]: {
    status: REPORT_PUBLICATION_STATUS.NOT_REQUESTED,
    publishedAt: null,
    ref: null,
    detail: null,
  },
  [REPORT_PUBLICATION_CHANNEL.TRACES]: {
    status: REPORT_PUBLICATION_STATUS.NOT_REQUESTED,
    publishedAt: null,
    ref: null,
    detail: null,
  },
});

const toOrganErrorRateSource = (
  reportRun: ReportRunRow,
  reports: ModelHealthReport[],
): OrganErrorRateSource | null => {
  if (reportRun.availabilityStatus === REPORT_AVAILABILITY.UNAVAILABLE) {
    return null;
  }

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
};

const uniqueSorted = (values: string[]): string[] =>
  Array.from(new Set(values.filter((entry) => entry.trim().length > 0))).sort();

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

const hashSourceSignature = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(stableNormalize(value)))
    .digest('hex');

const reportRowAvailabilityRank = (value: ReportAvailability): number => {
  switch (value) {
    case REPORT_AVAILABILITY.FRESH:
      return 0;
    case REPORT_AVAILABILITY.DEGRADED:
      return 1;
    case REPORT_AVAILABILITY.NOT_EVALUABLE:
      return 2;
    case REPORT_AVAILABILITY.UNAVAILABLE:
      return 3;
  }
};

const mostDegradedAvailability = (values: ReportAvailability[]): ReportAvailability =>
  [...values].sort(
    (left, right) => reportRowAvailabilityRank(right) - reportRowAvailabilityRank(left),
  )[0] ?? REPORT_AVAILABILITY.UNAVAILABLE;

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

const runtimeModeToIdentityReportMode = (
  value: 'inactive' | 'normal' | 'degraded' | 'recovery',
): IdentityContinuityReport['runtimeMode'] => {
  switch (value) {
    case 'inactive':
      return 'stopped';
    case 'normal':
      return 'live';
    case 'degraded':
      return 'degraded';
    case 'recovery':
      return 'recovery';
  }
};

const baselineHealthStatus = (input: {
  status: string;
  healthJson: Record<string, unknown>;
}): {
  availability: ReportAvailability;
  healthStatus: ModelHealthReport['healthStatus'];
  errorRate: number | null;
} => {
  const readiness = input.healthJson['readiness'];
  const healthy =
    typeof input.healthJson['healthy'] === 'boolean' ? input.healthJson['healthy'] : true;
  const errorRate =
    typeof input.healthJson['errorRate'] === 'number' &&
    Number.isFinite(input.healthJson['errorRate'])
      ? input.healthJson['errorRate']
      : null;

  if (input.status === 'disabled' || readiness === 'unavailable') {
    return {
      availability: REPORT_AVAILABILITY.UNAVAILABLE,
      healthStatus: 'unavailable',
      errorRate,
    };
  }

  if (readiness === 'degraded' || healthy === false) {
    return {
      availability: REPORT_AVAILABILITY.DEGRADED,
      healthStatus: 'degraded',
      errorRate,
    };
  }

  return {
    availability: REPORT_AVAILABILITY.FRESH,
    healthStatus: 'healthy',
    errorRate,
  };
};

const richerHealthStatus = (input: {
  availability: 'available' | 'degraded' | 'unavailable';
  healthy: boolean | null;
  quarantineState: 'clear' | 'active';
  errorRate: number | null;
}): {
  availability: ReportAvailability;
  healthStatus: ModelHealthReport['healthStatus'];
  errorRate: number | null;
} => {
  if (input.availability === 'unavailable') {
    return {
      availability: REPORT_AVAILABILITY.UNAVAILABLE,
      healthStatus: 'unavailable',
      errorRate: input.errorRate,
    };
  }

  if (
    input.availability === 'degraded' ||
    input.healthy === false ||
    input.quarantineState === 'active'
  ) {
    return {
      availability: REPORT_AVAILABILITY.DEGRADED,
      healthStatus: 'degraded',
      errorRate: input.errorRate,
    };
  }

  return {
    availability: REPORT_AVAILABILITY.FRESH,
    healthStatus: 'healthy',
    errorRate: input.errorRate,
  };
};

export const createReportingService = (options: ReportingServiceOptions): ReportingService => {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;
  const schemaVersion = options.schemaVersion ?? REPORTING_SCHEMA_VERSION;

  const recordRun = async (
    reportFamily: ReportFamily,
    materializedAt: string,
    availability: ReportAvailability,
    sourceRefs: string[],
    sourceOwnerRefs: ReportSourceOwner[],
    signaturePayload: unknown,
  ) => {
    const result = await options.store.recordReportRun({
      reportRunId: `report-run:${reportFamily}:${createId()}`,
      reportFamily,
      sourceRefs: uniqueSorted(sourceRefs),
      sourceOwnerRefs: uniqueSorted(sourceOwnerRefs) as ReportSourceOwner[],
      sourceSnapshotSignature: hashSourceSignature(signaturePayload),
      materializedAt,
      availabilityStatus: availability,
      schemaVersion,
      publication: defaultPublicationMetadata(),
      requestedWriteSurfaces: ['polyphony_runtime.report_runs'],
    });

    if (!result.accepted) {
      throw new Error(
        `reporting refused write surface ${result.rejectedWriteSurface} for ${reportFamily}`,
      );
    }

    return result.reportRun;
  };

  const materializeIdentityContinuityReport = async (): Promise<IdentityContinuityReport> => {
    const materializedAt = now().toISOString();
    const source = await options.loadIdentityContinuitySource({ materializedAt });
    const reportRun = await recordRun(
      REPORT_FAMILY.IDENTITY_CONTINUITY,
      materializedAt,
      source.availability,
      source.sourceRefs,
      source.sourceOwnerRefs,
      {
        sourceRefs: source.sourceRefs,
        sourceOwnerRefs: source.sourceOwnerRefs,
        availability: source.availability,
        payload: source.signaturePayload,
      },
    );

    const existing = await options.store.getIdentityContinuityReport(reportRun.reportRunId);
    if (existing) {
      return existing;
    }

    return await options.store.upsertIdentityContinuityReport({
      reportRunId: reportRun.reportRunId,
      reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
      sourceRefs: reportRun.sourceRefsJson,
      sourceOwnerRefs: reportRun.sourceOwnerRefsJson,
      availability: source.availability,
      materializedAt: reportRun.materializedAt,
      runtimeMode: source.report.runtimeMode,
      currentTickRef: source.report.currentTickRef,
      lastStableSnapshotRef: source.report.lastStableSnapshotRef,
      recentRecoveryRefs: source.report.recentRecoveryRefs,
    });
  };

  const materializeModelHealthFamily = async (): Promise<MaterializedModelHealthFamily> => {
    const materializedAt = now().toISOString();
    const source = await options.loadModelHealthSource({ materializedAt });
    const sourceRefs =
      source.sourceRefs.length > 0 ? source.sourceRefs : MODEL_HEALTH_MISSING_SOURCE_REFS;
    const sourceOwnerRefs =
      source.sourceOwnerRefs.length > 0
        ? source.sourceOwnerRefs
        : MODEL_HEALTH_MISSING_SOURCE_OWNERS;
    const reportRun = await recordRun(
      REPORT_FAMILY.MODEL_HEALTH,
      materializedAt,
      source.availability,
      sourceRefs,
      sourceOwnerRefs,
      {
        sourceRefs,
        sourceOwnerRefs,
        availability: source.availability,
        payload: source.signaturePayload,
      },
    );

    const existing = await options.store.listModelHealthReports({
      reportRunId: reportRun.reportRunId,
    });
    if (existing.length > 0) {
      return {
        reportRun,
        reports: existing,
      };
    }

    return {
      reportRun,
      reports: await options.store.replaceModelHealthReports({
        reportRunId: reportRun.reportRunId,
        reports: source.report.map((report) => ({
          reportRunId: reportRun.reportRunId,
          reportFamily: REPORT_FAMILY.MODEL_HEALTH,
          sourceRefs: reportRun.sourceRefsJson,
          sourceOwnerRefs: reportRun.sourceOwnerRefsJson,
          availability: report.availability,
          materializedAt: reportRun.materializedAt,
          organId: report.organId,
          profileId: report.profileId,
          healthStatus: report.healthStatus,
          errorRate: report.errorRate,
          fallbackRef: report.fallbackRef,
          sourceSurfaceRefs: report.sourceSurfaceRefs,
        })),
      }),
    };
  };

  const materializeModelHealthReports = async (): Promise<ModelHealthReport[]> =>
    (await materializeModelHealthFamily()).reports;

  const materializeStableSnapshotInventoryReport =
    async (): Promise<StableSnapshotInventoryReport> => {
      const materializedAt = now().toISOString();
      const source = await options.loadStableSnapshotInventorySource({ materializedAt });
      const reportRun = await recordRun(
        REPORT_FAMILY.STABLE_SNAPSHOT_INVENTORY,
        materializedAt,
        source.availability,
        source.sourceRefs,
        source.sourceOwnerRefs,
        {
          sourceRefs: source.sourceRefs,
          sourceOwnerRefs: source.sourceOwnerRefs,
          availability: source.availability,
          payload: source.signaturePayload,
        },
      );

      const existing = await options.store.getStableSnapshotInventoryReport(reportRun.reportRunId);
      if (existing) {
        return existing;
      }

      return await options.store.upsertStableSnapshotInventoryReport({
        reportRunId: reportRun.reportRunId,
        reportFamily: REPORT_FAMILY.STABLE_SNAPSHOT_INVENTORY,
        sourceRefs: reportRun.sourceRefsJson,
        sourceOwnerRefs: reportRun.sourceOwnerRefsJson,
        availability: source.availability,
        materializedAt: reportRun.materializedAt,
        latestStableSnapshotRef: source.report.latestStableSnapshotRef,
        totalSnapshots: source.report.totalSnapshots,
        snapshots: source.report.snapshots,
      });
    };

  const materializeDevelopmentDiagnosticsReport =
    async (): Promise<DevelopmentDiagnosticsReport> => {
      const materializedAt = now().toISOString();
      const source = await options.loadDevelopmentDiagnosticsSource({ materializedAt });
      const reportRun = await recordRun(
        REPORT_FAMILY.DEVELOPMENT_DIAGNOSTICS,
        materializedAt,
        source.availability,
        source.sourceRefs,
        source.sourceOwnerRefs,
        {
          sourceRefs: source.sourceRefs,
          sourceOwnerRefs: source.sourceOwnerRefs,
          availability: source.availability,
          payload: source.signaturePayload,
        },
      );

      const existing = await options.store.getDevelopmentDiagnosticsReport(reportRun.reportRunId);
      if (existing) {
        return existing;
      }

      return await options.store.upsertDevelopmentDiagnosticsReport({
        reportRunId: reportRun.reportRunId,
        reportFamily: REPORT_FAMILY.DEVELOPMENT_DIAGNOSTICS,
        sourceRefs: reportRun.sourceRefsJson,
        sourceOwnerRefs: reportRun.sourceOwnerRefsJson,
        availability: source.availability,
        materializedAt: reportRun.materializedAt,
        developmentFreezeActive: source.report.developmentFreezeActive,
        ledgerEntryCountLast30d: source.report.ledgerEntryCountLast30d,
        proposalCountLast30d: source.report.proposalCountLast30d,
        recentLedgerRefs: source.report.recentLedgerRefs,
        recentFailedActionRefs: source.report.recentFailedActionRefs,
      });
    };

  const materializeLifecycleDiagnosticsReport = async (): Promise<LifecycleDiagnosticsReport> => {
    const materializedAt = now().toISOString();
    const source = await options.loadLifecycleDiagnosticsSource({ materializedAt });
    const reportRun = await recordRun(
      REPORT_FAMILY.LIFECYCLE_DIAGNOSTICS,
      materializedAt,
      source.availability,
      source.sourceRefs,
      source.sourceOwnerRefs,
      {
        sourceRefs: source.sourceRefs,
        sourceOwnerRefs: source.sourceOwnerRefs,
        availability: source.availability,
        payload: source.signaturePayload,
      },
    );

    const existing = await options.store.getLifecycleDiagnosticsReport(reportRun.reportRunId);
    if (existing) {
      return existing;
    }

    return await options.store.upsertLifecycleDiagnosticsReport({
      reportRunId: reportRun.reportRunId,
      reportFamily: REPORT_FAMILY.LIFECYCLE_DIAGNOSTICS,
      sourceRefs: reportRun.sourceRefsJson,
      sourceOwnerRefs: reportRun.sourceOwnerRefsJson,
      availability: source.availability,
      materializedAt: reportRun.materializedAt,
      rollbackIncidentCountLast30d: source.report.rollbackIncidentCountLast30d,
      gracefulShutdownCountLast30d: source.report.gracefulShutdownCountLast30d,
      recentRollbackRefs: source.report.recentRollbackRefs,
      recentGracefulShutdownRefs: source.report.recentGracefulShutdownRefs,
      recentCompactionRefs: source.report.recentCompactionRefs,
    });
  };

  const getReportingBundle = async (): Promise<ReportingBundle> => {
    const [
      identityContinuity,
      modelHealthFamily,
      stableSnapshotInventory,
      developmentDiagnostics,
      lifecycleDiagnostics,
    ] = await Promise.all([
      materializeIdentityContinuityReport(),
      materializeModelHealthFamily(),
      materializeStableSnapshotInventoryReport(),
      materializeDevelopmentDiagnosticsReport(),
      materializeLifecycleDiagnosticsReport(),
    ]);
    const [identityRun, modelRun, stableRun, developmentRun, lifecycleRun] = await Promise.all([
      options.store.getReportRun(identityContinuity.reportRunId),
      options.store.getReportRun(modelHealthFamily.reportRun.reportRunId),
      options.store.getReportRun(stableSnapshotInventory.reportRunId),
      options.store.getReportRun(developmentDiagnostics.reportRunId),
      options.store.getReportRun(lifecycleDiagnostics.reportRunId),
    ]);

    return {
      generatedAt: now().toISOString(),
      reportRuns: {
        identityContinuity: identityRun,
        modelHealth: modelRun,
        stableSnapshotInventory: stableRun,
        developmentDiagnostics: developmentRun,
        lifecycleDiagnostics: lifecycleRun,
      },
      reports: {
        identityContinuity,
        modelHealth: modelHealthFamily.reports,
        stableSnapshotInventory,
        developmentDiagnostics,
        lifecycleDiagnostics,
      },
    };
  };

  return {
    materializeIdentityContinuityReport,
    materializeModelHealthReports,
    materializeStableSnapshotInventoryReport,
    materializeDevelopmentDiagnosticsReport,
    materializeLifecycleDiagnosticsReport,
    materializeAllReportFamilies: getReportingBundle,
    getIdentityContinuityReport: materializeIdentityContinuityReport,
    getModelHealthReports: materializeModelHealthReports,
    getStableSnapshotInventoryReport: materializeStableSnapshotInventoryReport,
    getDevelopmentDiagnosticsReport: materializeDevelopmentDiagnosticsReport,
    getLifecycleDiagnosticsReport: materializeLifecycleDiagnosticsReport,
    async loadOrganErrorRateSource(): Promise<OrganErrorRateSource | null> {
      const modelHealthFamily = await materializeModelHealthFamily();
      return toOrganErrorRateSource(modelHealthFamily.reportRun, modelHealthFamily.reports);
    },
    async publishReportArtifact(input: PublishReportArtifactInput): Promise<ReportRunRow> {
      const reportRun = await options.store.getReportRun(input.reportRunId);
      if (!reportRun) {
        throw new Error(`missing report run ${input.reportRunId}`);
      }

      if (reportRun.reportFamily !== input.reportFamily) {
        throw new Error(
          `report run ${input.reportRunId} belongs to ${reportRun.reportFamily}, not ${input.reportFamily}`,
        );
      }

      const nextPublication = {
        ...reportRun.publicationJson,
        [input.channel]: {
          status: input.status ?? REPORT_PUBLICATION_STATUS.PUBLISHED,
          publishedAt: input.publishedAt ?? now().toISOString(),
          ref: input.ref,
          detail: input.detail ?? null,
        },
      } satisfies ReportPublicationMetadata;

      return await options.store.updateReportPublication({
        reportRunId: reportRun.reportRunId,
        publication: nextPublication,
      });
    },
    getReportingBundle,
  };
};

export const createDbBackedReportingService = (
  config: Pick<CoreRuntimeConfig, 'postgresUrl'>,
): ReportingService => {
  const loadIdentityContinuitySource = async (_input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Pick<
        IdentityContinuityReport,
        'runtimeMode' | 'currentTickRef' | 'lastStableSnapshotRef' | 'recentRecoveryRefs'
      >
    >
  > =>
    await withRuntimeClient(config.postgresUrl, async (client) => {
      void _input;
      const tickStore = createTickRuntimeStore(client);
      const state = await tickStore.getAgentState();
      if (!state) {
        return {
          availability: REPORT_AVAILABILITY.UNAVAILABLE,
          sourceRefs: ['agent_state:none'],
          sourceOwnerRefs: [REPORT_SOURCE_OWNER.TICK_RUNTIME],
          report: {
            runtimeMode: 'stopped',
            currentTickRef: null,
            lastStableSnapshotRef: null,
            recentRecoveryRefs: [],
          },
          signaturePayload: { missing: true },
        };
      }

      const recoveryResult = await client.query<{ recoveryRefs: unknown }>(
        `select coalesce((
           select jsonb_agg('rollback_incident:' || rollback_incident_id order by recorded_at desc)
           from (
             select rollback_incident_id, recorded_at
             from polyphony_runtime.rollback_incidents
             order by recorded_at desc, rollback_incident_id desc
             limit 5
           ) recent_rollback_incidents
         ), '[]'::jsonb) as "recoveryRefs"`,
      );
      const bootSnapshotRef =
        typeof state.bootStateJson['snapshotId'] === 'string'
          ? `stable_snapshot:${state.bootStateJson['snapshotId']}`
          : null;
      const recentRecoveryRefs = uniqueSorted([
        ...(bootSnapshotRef ? [bootSnapshotRef] : []),
        ...((Array.isArray(recoveryResult.rows[0]?.recoveryRefs)
          ? recoveryResult.rows[0]?.recoveryRefs
          : []) as string[]),
      ]);
      const currentTickRef = state.currentTickId ? `tick:${state.currentTickId}` : null;
      const lastStableSnapshotRef = state.lastStableSnapshotId
        ? `stable_snapshot:${state.lastStableSnapshotId}`
        : null;
      const sourceOwnerRefs = uniqueSorted([
        REPORT_SOURCE_OWNER.TICK_RUNTIME,
        REPORT_SOURCE_OWNER.BOOT_RECOVERY,
        ...(lastStableSnapshotRef ? [REPORT_SOURCE_OWNER.BODY_EVOLUTION] : []),
        ...(recentRecoveryRefs.some((ref) => ref.startsWith('rollback_incident:'))
          ? [REPORT_SOURCE_OWNER.LIFECYCLE]
          : []),
      ]) as ReportSourceOwner[];

      return {
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: uniqueSorted([
          'agent_state:polyphony-core',
          ...(currentTickRef ? [currentTickRef] : []),
          ...(lastStableSnapshotRef ? [lastStableSnapshotRef] : []),
          ...recentRecoveryRefs,
        ]),
        sourceOwnerRefs,
        report: {
          runtimeMode: runtimeModeToIdentityReportMode(state.mode),
          currentTickRef,
          lastStableSnapshotRef,
          recentRecoveryRefs,
        },
        signaturePayload: {
          mode: state.mode,
          currentTickId: state.currentTickId,
          lastStableSnapshotId: state.lastStableSnapshotId,
          recentRecoveryRefs,
        },
      };
    });

  const loadStableSnapshotInventorySource = async (_input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Pick<
        StableSnapshotInventoryReport,
        'latestStableSnapshotRef' | 'totalSnapshots' | 'snapshots'
      >
    >
  > =>
    await withRuntimeClient(config.postgresUrl, async (client) => {
      void _input;
      const tickStore = createTickRuntimeStore(client);
      const state = await tickStore.getAgentState();
      const result = await client.query<{
        snapshotId: string;
        proposalId: string;
        gitTag: string;
        schemaVersion: string;
        modelProfileMapJson: Record<string, string>;
        createdAt: string;
      }>(
        `select
           snapshot_id as "snapshotId",
           proposal_id as "proposalId",
           git_tag as "gitTag",
           schema_version as "schemaVersion",
           model_profile_map_json as "modelProfileMapJson",
           to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt"
         from polyphony_runtime.stable_snapshots
         order by created_at desc, snapshot_id desc`,
      );

      const snapshots: StableSnapshotInventoryEntry[] = result.rows.map((row) => {
        const snapshotRef = `stable_snapshot:${row.snapshotId}`;
        const isCurrentStable = state?.lastStableSnapshotId === row.snapshotId;
        return {
          snapshotRef,
          proposalId: row.proposalId,
          gitTag: row.gitTag,
          schemaVersion: row.schemaVersion,
          isCurrentStable,
          createdAt: row.createdAt,
          rollbackAnchorRefs: uniqueSorted([
            snapshotRef,
            ...(isCurrentStable ? ['agent_state:last_stable_snapshot_id'] : []),
          ]),
          modelProfileMap: row.modelProfileMapJson ?? {},
        };
      });

      const latestStableSnapshotRef = state?.lastStableSnapshotId
        ? `stable_snapshot:${state.lastStableSnapshotId}`
        : (snapshots[0]?.snapshotRef ?? null);
      const currentStableMissing =
        latestStableSnapshotRef != null &&
        !snapshots.some((snapshot) => snapshot.snapshotRef === latestStableSnapshotRef);

      return {
        availability: currentStableMissing
          ? REPORT_AVAILABILITY.DEGRADED
          : REPORT_AVAILABILITY.FRESH,
        sourceRefs: uniqueSorted([
          ...(snapshots.map((snapshot) => snapshot.snapshotRef) ?? []),
          ...(latestStableSnapshotRef ? [latestStableSnapshotRef] : ['stable_snapshot:none']),
        ]),
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.BODY_EVOLUTION, REPORT_SOURCE_OWNER.BOOT_RECOVERY],
        report: {
          latestStableSnapshotRef,
          totalSnapshots: snapshots.length,
          snapshots,
        },
        signaturePayload: {
          latestStableSnapshotRef,
          snapshots,
          currentStableMissing,
        },
      };
    });

  const loadModelHealthSource = async (_input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Array<
        Pick<
          ModelHealthReport,
          | 'organId'
          | 'profileId'
          | 'healthStatus'
          | 'errorRate'
          | 'fallbackRef'
          | 'sourceSurfaceRefs'
        > & { availability: ReportAvailability }
      >
    >
  > =>
    await withRuntimeClient(config.postgresUrl, async (client) => {
      void _input;
      const modelProfileStore = createRuntimeModelProfileStore(client);
      const ecologyStore = createExpandedModelEcologyStore(client);
      const baselineProfiles = await modelProfileStore.listModelProfiles({
        roles: Object.values(BASELINE_MODEL_PROFILE_ROLE),
      });
      const richerProfiles = await modelProfileStore.listModelProfiles({
        roles: Object.values(RICHER_MODEL_PROFILE_ROLE),
      });
      const [richerHealthRows, richerFallbackLinks] = await Promise.all([
        ecologyStore.listProfileHealth({
          modelProfileIds: richerProfiles.map((profile) => profile.modelProfileId),
        }),
        ecologyStore.listFallbackLinks({
          modelProfileIds: richerProfiles.map((profile) => profile.modelProfileId),
        }),
      ]);
      const healthByProfileId = new Map(
        richerHealthRows.map((row) => [row.modelProfileId, row] as const),
      );
      const fallbackByProfileId = new Map(
        richerFallbackLinks.map((row) => [row.modelProfileId, row] as const),
      );

      const baselineReports = baselineProfiles.map((profile) => {
        const health = baselineHealthStatus({
          status: profile.status,
          healthJson: profile.healthJson,
        });
        return {
          organId: profile.role,
          profileId: profile.modelProfileId,
          availability: health.availability,
          healthStatus: health.healthStatus,
          errorRate: health.errorRate,
          fallbackRef: profile.adapterOf ? `model_profile:${profile.adapterOf}` : null,
          sourceSurfaceRefs: [`model_registry:${profile.modelProfileId}`],
        };
      });

      const richerReports = richerProfiles.map((profile) => {
        const richerHealth = healthByProfileId.get(profile.modelProfileId);
        const fallback = fallbackByProfileId.get(profile.modelProfileId);
        const health = richerHealth
          ? richerHealthStatus({
              availability: richerHealth.availability,
              healthy: richerHealth.healthy,
              quarantineState: richerHealth.quarantineState,
              errorRate: richerHealth.errorRate,
            })
          : {
              availability: REPORT_AVAILABILITY.DEGRADED,
              healthStatus: 'unavailable' as const,
              errorRate: null,
            };

        return {
          organId: profile.role,
          profileId: profile.modelProfileId,
          availability: health.availability,
          healthStatus: health.healthStatus,
          errorRate: health.errorRate,
          fallbackRef: fallback?.fallbackTargetProfileId
            ? `model_profile:${fallback.fallbackTargetProfileId}`
            : null,
          sourceSurfaceRefs: uniqueSorted([
            `model_registry:${profile.modelProfileId}`,
            ...(richerHealth ? [`model_profile_health:${profile.modelProfileId}`] : []),
            ...(fallback ? [`model_fallback_link:${profile.modelProfileId}`] : []),
          ]),
        };
      });

      const reports = [...baselineReports, ...richerReports];
      const availability =
        reports.length === 0
          ? REPORT_AVAILABILITY.UNAVAILABLE
          : mostDegradedAvailability(reports.map((report) => report.availability));
      const sourceOwnerRefs =
        reports.length === 0
          ? MODEL_HEALTH_MISSING_SOURCE_OWNERS
          : (uniqueSorted([
              ...(baselineProfiles.length > 0 ? [REPORT_SOURCE_OWNER.BASELINE_MODEL_ROUTING] : []),
              ...(richerProfiles.length > 0 ? [REPORT_SOURCE_OWNER.EXPANDED_MODEL_ECOLOGY] : []),
            ]) as ReportSourceOwner[]);
      const sourceRefs =
        reports.length === 0
          ? MODEL_HEALTH_MISSING_SOURCE_REFS
          : uniqueSorted(
              reports.flatMap((report) =>
                report.sourceSurfaceRefs.length > 0
                  ? report.sourceSurfaceRefs
                  : [`model_health:none:${report.organId}`],
              ),
            );

      return {
        availability,
        sourceRefs,
        sourceOwnerRefs,
        report: reports,
        signaturePayload: {
          baselineProfiles,
          richerProfiles,
          richerHealthRows,
          richerFallbackLinks,
        },
      };
    });

  const loadDevelopmentDiagnosticsSource = async (input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Pick<
        DevelopmentDiagnosticsReport,
        | 'developmentFreezeActive'
        | 'ledgerEntryCountLast30d'
        | 'proposalCountLast30d'
        | 'recentLedgerRefs'
        | 'recentFailedActionRefs'
      >
    >
  > =>
    await withRuntimeClient(config.postgresUrl, async (client) => {
      const tickStore = createTickRuntimeStore(client);
      const agentState = await tickStore.getAgentState();
      const result = await client.query<{
        ledgerEntryCountLast30d: string;
        proposalCountLast30d: string;
        recentLedgerRefs: unknown;
        recentFailedActionRefs: unknown;
      }>(
        `select
           (
             select count(*)::text
             from polyphony_runtime.development_ledger
             where created_at >= $1::timestamptz - interval '30 day'
               and created_at <= $1::timestamptz
           ) as "ledgerEntryCountLast30d",
           (
             select count(*)::text
             from polyphony_runtime.development_proposals
             where created_at >= $1::timestamptz - interval '30 day'
               and created_at <= $1::timestamptz
           ) as "proposalCountLast30d",
           coalesce((
             select jsonb_agg('development_ledger:' || ledger_id order by created_at desc)
             from (
               select ledger_id, created_at
               from polyphony_runtime.development_ledger
               where created_at >= $1::timestamptz - interval '30 day'
                 and created_at <= $1::timestamptz
               order by created_at desc, ledger_id desc
               limit 5
             ) recent_ledger
           ), '[]'::jsonb) as "recentLedgerRefs",
           coalesce((
             select jsonb_agg('action_log:' || action_id order by created_at desc)
             from (
               select action_id, created_at
               from polyphony_runtime.action_log
               where success = false
                 and created_at >= $1::timestamptz - interval '30 day'
                 and created_at <= $1::timestamptz
               order by created_at desc, action_id desc
               limit 5
             ) recent_failed_actions
           ), '[]'::jsonb) as "recentFailedActionRefs"`,
        [input.materializedAt],
      );

      const row = result.rows[0];
      const recentLedgerRefs = uniqueSorted(
        (Array.isArray(row?.recentLedgerRefs) ? row.recentLedgerRefs : []) as string[],
      );
      const recentFailedActionRefs = uniqueSorted(
        (Array.isArray(row?.recentFailedActionRefs) ? row.recentFailedActionRefs : []) as string[],
      );

      return {
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: uniqueSorted([
          ...(recentLedgerRefs.length > 0 ? recentLedgerRefs : ['development_ledger:none']),
          ...(recentFailedActionRefs.length > 0
            ? recentFailedActionRefs
            : ['action_log:failed:none']),
        ]),
        sourceOwnerRefs: [
          REPORT_SOURCE_OWNER.ACTION_AUDIT,
          REPORT_SOURCE_OWNER.DEVELOPMENT_GOVERNOR,
        ],
        report: {
          developmentFreezeActive: agentState?.developmentFreeze ?? false,
          ledgerEntryCountLast30d: Number(row?.ledgerEntryCountLast30d ?? 0),
          proposalCountLast30d: Number(row?.proposalCountLast30d ?? 0),
          recentLedgerRefs,
          recentFailedActionRefs,
        },
        signaturePayload: {
          developmentFreezeActive: agentState?.developmentFreeze ?? false,
          counts: row,
        },
      };
    });

  const loadLifecycleDiagnosticsSource = async (input: {
    materializedAt: string;
  }): Promise<
    ReportingSource<
      Pick<
        LifecycleDiagnosticsReport,
        | 'rollbackIncidentCountLast30d'
        | 'gracefulShutdownCountLast30d'
        | 'recentRollbackRefs'
        | 'recentGracefulShutdownRefs'
        | 'recentCompactionRefs'
      >
    >
  > =>
    await withRuntimeClient(config.postgresUrl, async (client) => {
      const result = await client.query<{
        rollbackIncidentCountLast30d: string;
        gracefulShutdownCountLast30d: string;
        recentRollbackRefs: unknown;
        recentGracefulShutdownRefs: unknown;
        recentCompactionRefs: unknown;
      }>(
        `select
           (
             select count(*)::text
             from polyphony_runtime.rollback_incidents
             where recorded_at >= $1::timestamptz - interval '30 day'
               and recorded_at <= $1::timestamptz
           ) as "rollbackIncidentCountLast30d",
           (
             select count(*)::text
             from polyphony_runtime.graceful_shutdown_events
             where recorded_at >= $1::timestamptz - interval '30 day'
               and recorded_at <= $1::timestamptz
           ) as "gracefulShutdownCountLast30d",
           coalesce((
             select jsonb_agg('rollback_incident:' || rollback_incident_id order by recorded_at desc)
             from (
               select rollback_incident_id, recorded_at
               from polyphony_runtime.rollback_incidents
               where recorded_at >= $1::timestamptz - interval '30 day'
                 and recorded_at <= $1::timestamptz
               order by recorded_at desc, rollback_incident_id desc
               limit 5
             ) recent_rollbacks
           ), '[]'::jsonb) as "recentRollbackRefs",
           coalesce((
             select jsonb_agg('graceful_shutdown:' || shutdown_event_id order by recorded_at desc)
             from (
               select shutdown_event_id, recorded_at
               from polyphony_runtime.graceful_shutdown_events
               where recorded_at >= $1::timestamptz - interval '30 day'
                 and recorded_at <= $1::timestamptz
               order by recorded_at desc, shutdown_event_id desc
               limit 5
             ) recent_shutdowns
           ), '[]'::jsonb) as "recentGracefulShutdownRefs",
           coalesce((
             select jsonb_agg('retention_compaction:' || compaction_run_id order by created_at desc)
             from (
               select compaction_run_id, created_at
               from polyphony_runtime.retention_compaction_runs
               where created_at >= $1::timestamptz - interval '30 day'
                 and created_at <= $1::timestamptz
               order by created_at desc, compaction_run_id desc
               limit 5
             ) recent_compactions
           ), '[]'::jsonb) as "recentCompactionRefs"`,
        [input.materializedAt],
      );

      const row = result.rows[0];
      const recentRollbackRefs = uniqueSorted(
        (Array.isArray(row?.recentRollbackRefs) ? row.recentRollbackRefs : []) as string[],
      );
      const recentGracefulShutdownRefs = uniqueSorted(
        (Array.isArray(row?.recentGracefulShutdownRefs)
          ? row.recentGracefulShutdownRefs
          : []) as string[],
      );
      const recentCompactionRefs = uniqueSorted(
        (Array.isArray(row?.recentCompactionRefs) ? row.recentCompactionRefs : []) as string[],
      );

      return {
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: uniqueSorted([
          ...(recentRollbackRefs.length > 0 ? recentRollbackRefs : ['rollback_incident:none']),
          ...(recentGracefulShutdownRefs.length > 0
            ? recentGracefulShutdownRefs
            : ['graceful_shutdown:none']),
          ...(recentCompactionRefs.length > 0
            ? recentCompactionRefs
            : ['retention_compaction:none']),
        ]),
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.LIFECYCLE],
        report: {
          rollbackIncidentCountLast30d: Number(row?.rollbackIncidentCountLast30d ?? 0),
          gracefulShutdownCountLast30d: Number(row?.gracefulShutdownCountLast30d ?? 0),
          recentRollbackRefs,
          recentGracefulShutdownRefs,
          recentCompactionRefs,
        },
        signaturePayload: {
          row,
        },
      };
    });

  const reportingDb: ReportingDbExecutor = {
    query: (async (text: string, values?: unknown[]) =>
      await withRuntimeClient(config.postgresUrl, async (client) => {
        return await client.query(text, values ? [...values] : undefined);
      })) as ReportingDbExecutor['query'],
  };

  return createReportingService({
    store: createReportingStore(reportingDb),
    loadIdentityContinuitySource,
    loadModelHealthSource,
    loadStableSnapshotInventorySource,
    loadDevelopmentDiagnosticsSource,
    loadLifecycleDiagnosticsSource,
  });
};
