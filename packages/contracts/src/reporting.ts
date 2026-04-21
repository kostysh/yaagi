export const REPORT_FAMILY = Object.freeze({
  IDENTITY_CONTINUITY: 'identity_continuity',
  MODEL_HEALTH: 'model_health',
  STABLE_SNAPSHOT_INVENTORY: 'stable_snapshot_inventory',
  DEVELOPMENT_DIAGNOSTICS: 'development_diagnostics',
  LIFECYCLE_DIAGNOSTICS: 'lifecycle_diagnostics',
} as const);

export type ReportFamily = (typeof REPORT_FAMILY)[keyof typeof REPORT_FAMILY];

export const REPORT_AVAILABILITY = Object.freeze({
  FRESH: 'fresh',
  DEGRADED: 'degraded',
  NOT_EVALUABLE: 'not_evaluable',
  UNAVAILABLE: 'unavailable',
} as const);

export type ReportAvailability = (typeof REPORT_AVAILABILITY)[keyof typeof REPORT_AVAILABILITY];

export const REPORT_SOURCE_OWNER = Object.freeze({
  BOOT_RECOVERY: 'F-0001',
  TICK_RUNTIME: 'F-0003',
  BASELINE_MODEL_ROUTING: 'F-0008',
  ACTION_AUDIT: 'F-0010',
  HOMEOSTAT: 'F-0012',
  EXPANDED_MODEL_ECOLOGY: 'F-0014',
  DEVELOPMENT_GOVERNOR: 'F-0016',
  BODY_EVOLUTION: 'F-0017',
  LIFECYCLE: 'F-0019',
} as const);

export type ReportSourceOwner = (typeof REPORT_SOURCE_OWNER)[keyof typeof REPORT_SOURCE_OWNER];

export const REPORT_PUBLICATION_CHANNEL = Object.freeze({
  METRICS: 'metrics',
  LOGS: 'logs',
  TRACES: 'traces',
} as const);

export type ReportPublicationChannel =
  (typeof REPORT_PUBLICATION_CHANNEL)[keyof typeof REPORT_PUBLICATION_CHANNEL];

export const REPORT_PUBLICATION_STATUS = Object.freeze({
  NOT_REQUESTED: 'not_requested',
  PUBLISHED: 'published',
  FAILED: 'failed',
} as const);

export type ReportPublicationStatus =
  (typeof REPORT_PUBLICATION_STATUS)[keyof typeof REPORT_PUBLICATION_STATUS];

export const REPORTING_REJECTION_REASON = Object.freeze({
  FOREIGN_OWNER_WRITE_REJECTED: 'foreign_owner_write_rejected',
} as const);

export type ReportingRejectionReason =
  (typeof REPORTING_REJECTION_REASON)[keyof typeof REPORTING_REJECTION_REASON];

export const REPORTING_OWNED_WRITE_SURFACE = Object.freeze({
  REPORT_RUNS: 'polyphony_runtime.report_runs',
  IDENTITY_CONTINUITY_REPORTS: 'polyphony_runtime.identity_continuity_reports',
  MODEL_HEALTH_REPORTS: 'polyphony_runtime.model_health_reports',
  STABLE_SNAPSHOT_INVENTORY_REPORTS: 'polyphony_runtime.stable_snapshot_inventory_reports',
  DEVELOPMENT_DIAGNOSTICS_REPORTS: 'polyphony_runtime.development_diagnostics_reports',
  LIFECYCLE_DIAGNOSTICS_REPORTS: 'polyphony_runtime.lifecycle_diagnostics_reports',
} as const);

export type ReportingOwnedWriteSurface =
  (typeof REPORTING_OWNED_WRITE_SURFACE)[keyof typeof REPORTING_OWNED_WRITE_SURFACE];

export const REPORTING_FOREIGN_WRITE_SURFACE = Object.freeze({
  AGENT_STATE: 'polyphony_runtime.agent_state',
  TICKS: 'polyphony_runtime.ticks',
  TIMELINE_EVENTS: 'polyphony_runtime.timeline_events',
  SUBJECT_STATE: 'polyphony_runtime.subject_state',
  SUBJECT_STATE_PSM_JSON: 'polyphony_runtime.subject_state.psm_json',
  SUBJECT_GOALS: 'polyphony_runtime.subject_goals',
  SUBJECT_BELIEFS: 'polyphony_runtime.subject_beliefs',
  MODEL_REGISTRY: 'polyphony_runtime.model_registry',
  MODEL_PROFILE_HEALTH: 'polyphony_runtime.model_profile_health',
  MODEL_FALLBACK_LINKS: 'polyphony_runtime.model_fallback_links',
  DEVELOPMENT_LEDGER: 'polyphony_runtime.development_ledger',
  LIFECYCLE_EVENTS: 'polyphony_runtime.lifecycle_events',
  CONSOLIDATION_TRANSITIONS: 'polyphony_runtime.consolidation_transitions',
  ROLLBACK_INCIDENTS: 'polyphony_runtime.rollback_incidents',
  GRACEFUL_SHUTDOWN_EVENTS: 'polyphony_runtime.graceful_shutdown_events',
  RETENTION_COMPACTION_RUNS: 'polyphony_runtime.retention_compaction_runs',
  BODY_STABLE_SNAPSHOTS: 'polyphony_runtime.body_stable_snapshots',
} as const);

export type ReportingForeignWriteSurface =
  (typeof REPORTING_FOREIGN_WRITE_SURFACE)[keyof typeof REPORTING_FOREIGN_WRITE_SURFACE];

export type ReportPublicationState = {
  status: ReportPublicationStatus;
  publishedAt: string | null;
  ref: string | null;
  detail: string | null;
};

export type ReportPublicationMetadata = Partial<
  Record<ReportPublicationChannel, ReportPublicationState>
>;

export type ReportRun = {
  reportRunId: string;
  reportFamily: ReportFamily;
  sourceRefs: string[];
  sourceOwnerRefs: ReportSourceOwner[];
  sourceSnapshotSignature: string;
  materializedAt: string;
  availabilityStatus: ReportAvailability;
  schemaVersion: string;
  publication: ReportPublicationMetadata;
};

export type MaterializedReportIdentity = {
  reportRunId: string;
  reportFamily: ReportFamily;
  sourceRefs: string[];
  sourceOwnerRefs: ReportSourceOwner[];
  availability: ReportAvailability;
  materializedAt: string;
};

export type IdentityContinuityReport = MaterializedReportIdentity & {
  reportFamily: typeof REPORT_FAMILY.IDENTITY_CONTINUITY;
  runtimeMode: 'booting' | 'live' | 'recovery' | 'degraded' | 'stopped';
  currentTickRef: string | null;
  lastStableSnapshotRef: string | null;
  recentRecoveryRefs: string[];
};

export type ModelHealthReport = MaterializedReportIdentity & {
  reportFamily: typeof REPORT_FAMILY.MODEL_HEALTH;
  organId: string;
  profileId: string | null;
  healthStatus: 'healthy' | 'degraded' | 'unavailable';
  errorRate: number | null;
  fallbackRef: string | null;
  sourceSurfaceRefs: string[];
};

export type StableSnapshotInventoryEntry = {
  snapshotRef: string;
  proposalId: string;
  gitTag: string;
  schemaVersion: string;
  isCurrentStable: boolean;
  createdAt: string;
  rollbackAnchorRefs: string[];
  modelProfileMap: Record<string, string>;
};

export type StableSnapshotInventoryReport = MaterializedReportIdentity & {
  reportFamily: typeof REPORT_FAMILY.STABLE_SNAPSHOT_INVENTORY;
  latestStableSnapshotRef: string | null;
  totalSnapshots: number;
  snapshots: StableSnapshotInventoryEntry[];
};

export type DevelopmentDiagnosticsReport = MaterializedReportIdentity & {
  reportFamily: typeof REPORT_FAMILY.DEVELOPMENT_DIAGNOSTICS;
  developmentFreezeActive: boolean;
  ledgerEntryCountLast30d: number;
  proposalCountLast30d: number;
  recentLedgerRefs: string[];
  recentFailedActionRefs: string[];
};

export type LifecycleDiagnosticsReport = MaterializedReportIdentity & {
  reportFamily: typeof REPORT_FAMILY.LIFECYCLE_DIAGNOSTICS;
  rollbackIncidentCountLast30d: number;
  gracefulShutdownCountLast30d: number;
  recentRollbackRefs: string[];
  recentGracefulShutdownRefs: string[];
  recentCompactionRefs: string[];
};

export type OrganErrorRateSource = {
  reportRunId: string;
  materializedAt: string;
  availability: ReportAvailability;
  metricValue: number;
  evidenceRefs: string[];
};

const reportFamilies = new Set<string>(Object.values(REPORT_FAMILY));
const reportAvailabilityStates = new Set<string>(Object.values(REPORT_AVAILABILITY));
const reportSourceOwners = new Set<string>(Object.values(REPORT_SOURCE_OWNER));
const publicationChannels = new Set<string>(Object.values(REPORT_PUBLICATION_CHANNEL));
const publicationStatuses = new Set<string>(Object.values(REPORT_PUBLICATION_STATUS));
const reportingOwnedWriteSurfaces = new Set<string>(Object.values(REPORTING_OWNED_WRITE_SURFACE));

export const isReportFamily = (value: string): value is ReportFamily => reportFamilies.has(value);

export const isReportAvailability = (value: string): value is ReportAvailability =>
  reportAvailabilityStates.has(value);

export const isReportSourceOwner = (value: string): value is ReportSourceOwner =>
  reportSourceOwners.has(value);

export const isReportPublicationChannel = (value: string): value is ReportPublicationChannel =>
  publicationChannels.has(value);

export const isReportPublicationStatus = (value: string): value is ReportPublicationStatus =>
  publicationStatuses.has(value);

export const isReportingOwnedWriteSurface = (value: string): value is ReportingOwnedWriteSurface =>
  reportingOwnedWriteSurfaces.has(value);

export const assertReportingOwnedWriteSurface = (surface: string): void => {
  if (!isReportingOwnedWriteSurface(surface)) {
    throw new Error(`${REPORTING_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED}: ${surface}`);
  }
};

const assertTimestamp = (value: string, field: string): void => {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(`reporting contract requires valid ${field}`);
  }
};

const assertOptionalTimestamp = (value: string | null, field: string): void => {
  if (value === null) {
    return;
  }

  assertTimestamp(value, field);
};

const assertOptionalString = (value: string | null, field: string): void => {
  if (value !== null && value.trim().length === 0) {
    throw new Error(`reporting contract requires non-empty ${field} when present`);
  }
};

export const assertValidReportPublicationMetadata = (metadata: ReportPublicationMetadata): void => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('reporting contract requires publication metadata object');
  }

  for (const [channel, state] of Object.entries(metadata)) {
    if (!isReportPublicationChannel(channel)) {
      throw new Error(`unknown reporting publication channel ${JSON.stringify(channel)}`);
    }

    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new Error(`reporting publication channel ${channel} requires object state`);
    }

    if (!isReportPublicationStatus(state.status)) {
      throw new Error(`unknown reporting publication status ${JSON.stringify(state.status)}`);
    }

    assertOptionalTimestamp(state.publishedAt, `${channel}.publishedAt`);
    assertOptionalString(state.ref, `${channel}.ref`);
    assertOptionalString(state.detail, `${channel}.detail`);
  }
};

export const assertValidReportRun = (reportRun: ReportRun): void => {
  if (reportRun.reportRunId.trim().length === 0) {
    throw new Error('report run requires reportRunId');
  }

  if (!isReportFamily(reportRun.reportFamily)) {
    throw new Error(`unknown reportFamily ${JSON.stringify(reportRun.reportFamily)}`);
  }

  if (reportRun.sourceRefs.length === 0) {
    throw new Error('report run requires sourceRefs');
  }

  if (!reportRun.sourceRefs.every((ref) => ref.trim().length > 0)) {
    throw new Error('report run sourceRefs must be non-empty strings');
  }

  if (reportRun.sourceOwnerRefs.length === 0) {
    throw new Error('report run requires sourceOwnerRefs');
  }

  if (!reportRun.sourceOwnerRefs.every(isReportSourceOwner)) {
    throw new Error('report run sourceOwnerRefs must contain only canonical owners');
  }

  if (reportRun.sourceSnapshotSignature.trim().length === 0) {
    throw new Error('report run requires sourceSnapshotSignature');
  }

  assertTimestamp(reportRun.materializedAt, 'materializedAt');

  if (!isReportAvailability(reportRun.availabilityStatus)) {
    throw new Error(`unknown report availability ${JSON.stringify(reportRun.availabilityStatus)}`);
  }

  if (reportRun.schemaVersion.trim().length === 0) {
    throw new Error('report run requires schemaVersion');
  }

  assertValidReportPublicationMetadata(reportRun.publication);
};
