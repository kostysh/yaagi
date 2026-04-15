export const LIFECYCLE_SOURCE_OWNER = Object.freeze({
  TICK_RUNTIME: 'F-0003',
  SUBJECT_STATE: 'F-0004',
  NARRATIVE_MEMETIC: 'F-0011',
  HOMEOSTAT: 'F-0012',
  GOVERNOR: 'F-0016',
  BODY_EVOLUTION: 'F-0017',
  CONSOLIDATION: 'F-0019',
  REPORTING: 'CF-015',
  RELEASE: 'CF-025',
} as const);

export type LifecycleSourceOwner =
  (typeof LIFECYCLE_SOURCE_OWNER)[keyof typeof LIFECYCLE_SOURCE_OWNER];

export const LIFECYCLE_EVENT_TYPE = Object.freeze({
  ROLLBACK_INCIDENT_RECORDED: 'lifecycle.rollback_incident.recorded',
  SHUTDOWN_REQUESTED: 'lifecycle.shutdown.requested',
  SHUTDOWN_COMPLETED: 'lifecycle.shutdown.completed',
  CONSOLIDATION_TRANSITION_ACCEPTED: 'consolidation.transition.accepted',
  CONSOLIDATION_TRANSITION_REJECTED: 'consolidation.transition.rejected',
  RETENTION_COMPACTION_COMPLETED: 'retention.compaction.completed',
} as const);

export type LifecycleEventType = (typeof LIFECYCLE_EVENT_TYPE)[keyof typeof LIFECYCLE_EVENT_TYPE];

export const CONSOLIDATION_TRANSITION_CLASS = Object.freeze({
  PROMOTE_MEMETIC_UNIT: 'promote_memetic_unit',
  MERGE_MEMETIC_UNITS: 'merge_memetic_units',
  SPLIT_MEMETIC_UNIT: 'split_memetic_unit',
  QUARANTINE_MEMETIC_UNIT: 'quarantine_memetic_unit',
  RETIRE_MEMETIC_UNIT: 'retire_memetic_unit',
  COMPACT_FIELD_JOURNAL: 'compact_field_journal',
  SUMMARIZE_REPEATED_EPISODES: 'summarize_repeated_episodes',
  PREPARE_DATASET_CANDIDATE: 'prepare_dataset_candidate',
  RETIRE_STALE_TENSION: 'retire_stale_tension',
} as const);

export type ConsolidationTransitionClass =
  (typeof CONSOLIDATION_TRANSITION_CLASS)[keyof typeof CONSOLIDATION_TRANSITION_CLASS];

export const CONSOLIDATION_TRANSITION_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const);

export type ConsolidationTransitionStatus =
  (typeof CONSOLIDATION_TRANSITION_STATUS)[keyof typeof CONSOLIDATION_TRANSITION_STATUS];

export const GRACEFUL_SHUTDOWN_STATE = Object.freeze({
  SHUTTING_DOWN: 'shutting_down',
  COMPLETED: 'completed',
} as const);

export type GracefulShutdownState =
  (typeof GRACEFUL_SHUTDOWN_STATE)[keyof typeof GRACEFUL_SHUTDOWN_STATE];

export const RETENTION_COMPACTION_MODE = Object.freeze({
  NON_DESTRUCTIVE: 'non_destructive',
  AGGREGATE_ONLY: 'aggregate_only',
  DESTRUCTIVE_ALLOWED: 'destructive_allowed',
} as const);

export type RetentionCompactionMode =
  (typeof RETENTION_COMPACTION_MODE)[keyof typeof RETENTION_COMPACTION_MODE];

export const LIFECYCLE_REJECTION_REASON = Object.freeze({
  UNSUPPORTED_TRANSITION_CLASS: 'unsupported_transition_class',
  FOREIGN_OWNER_WRITE_REJECTED: 'foreign_owner_write_rejected',
  IDEMPOTENCY_CONFLICT: 'idempotency_conflict',
  MISSING_PROVENANCE_ANCHOR: 'missing_provenance_anchor',
  COMPACTION_VERSION_REF_MISSING: 'compaction_version_ref_missing',
  RETENTION_POLICY_REJECTED: 'retention_policy_rejected',
  SHUTDOWN_ADMISSION_CLOSED: 'shutdown_admission_closed',
  SHUTDOWN_TERMINAL_EVIDENCE_MISSING: 'shutdown_terminal_evidence_missing',
} as const);

export type LifecycleRejectionReason =
  (typeof LIFECYCLE_REJECTION_REASON)[keyof typeof LIFECYCLE_REJECTION_REASON];

export const LIFECYCLE_OWNED_WRITE_SURFACE = Object.freeze({
  LIFECYCLE_EVENTS: 'polyphony_runtime.lifecycle_events',
  CONSOLIDATION_TRANSITIONS: 'polyphony_runtime.consolidation_transitions',
  ROLLBACK_INCIDENTS: 'polyphony_runtime.rollback_incidents',
  GRACEFUL_SHUTDOWN_EVENTS: 'polyphony_runtime.graceful_shutdown_events',
  RETENTION_COMPACTION_RUNS: 'polyphony_runtime.retention_compaction_runs',
} as const);

export type LifecycleOwnedWriteSurface =
  (typeof LIFECYCLE_OWNED_WRITE_SURFACE)[keyof typeof LIFECYCLE_OWNED_WRITE_SURFACE];

export const LIFECYCLE_FOREIGN_WRITE_SURFACE = Object.freeze({
  TICKS: 'polyphony_runtime.ticks',
  EPISODES: 'polyphony_runtime.episodes',
  TIMELINE_EVENTS: 'polyphony_runtime.timeline_events',
  SUBJECT_STATE: 'polyphony_runtime.subject_state',
  SUBJECT_BELIEFS: 'polyphony_runtime.subject_beliefs',
  SUBJECT_GOALS: 'polyphony_runtime.subject_goals',
  DEVELOPMENT_LEDGER: 'polyphony_runtime.development_ledger',
  DEVELOPMENT_PROPOSALS: 'polyphony_runtime.development_proposals',
  WORKSHOP_DATASETS: 'polyphony_runtime.workshop_datasets',
  WORKSHOP_TRAINING_RUNS: 'polyphony_runtime.workshop_training_runs',
  WORKSHOP_EVAL_RUNS: 'polyphony_runtime.workshop_eval_runs',
  WORKSHOP_MODEL_CANDIDATES: 'polyphony_runtime.workshop_model_candidates',
  BODY_CHANGE_EVENTS: 'polyphony_runtime.body_change_events',
  BODY_STABLE_SNAPSHOTS: 'polyphony_runtime.body_stable_snapshots',
  REPORTING_PROJECTIONS: 'reporting.projections',
  RELEASE_DEPLOY_STATE: 'release.deploy_state',
} as const);

export type LifecycleForeignWriteSurface =
  (typeof LIFECYCLE_FOREIGN_WRITE_SURFACE)[keyof typeof LIFECYCLE_FOREIGN_WRITE_SURFACE];

export type LifecycleEventEnvelope = {
  eventId: string;
  eventType: LifecycleEventType;
  occurredAt: string;
  sourceOwner: LifecycleSourceOwner;
  subjectRef: string;
  schemaVersion: string;
  idempotencyKey: string;
  evidenceRefs: string[];
  payload: Record<string, unknown>;
};

const sourceOwners = new Set<string>(Object.values(LIFECYCLE_SOURCE_OWNER));
const eventTypes = new Set<string>(Object.values(LIFECYCLE_EVENT_TYPE));
const transitionClasses = new Set<string>(Object.values(CONSOLIDATION_TRANSITION_CLASS));
const ownedWriteSurfaces = new Set<string>(Object.values(LIFECYCLE_OWNED_WRITE_SURFACE));

export const isLifecycleSourceOwner = (value: string): value is LifecycleSourceOwner =>
  sourceOwners.has(value);

export const isLifecycleEventType = (value: string): value is LifecycleEventType =>
  eventTypes.has(value);

export const isConsolidationTransitionClass = (
  value: string,
): value is ConsolidationTransitionClass => transitionClasses.has(value);

export const isLifecycleOwnedWriteSurface = (value: string): value is LifecycleOwnedWriteSurface =>
  ownedWriteSurfaces.has(value);

export const assertLifecycleOwnedWriteSurface = (surface: string): void => {
  if (!isLifecycleOwnedWriteSurface(surface)) {
    throw new Error(`${LIFECYCLE_REJECTION_REASON.FOREIGN_OWNER_WRITE_REJECTED}: ${surface}`);
  }
};

export const assertValidLifecycleEventEnvelope = (envelope: LifecycleEventEnvelope): void => {
  if (envelope.eventId.trim().length === 0) {
    throw new Error('lifecycle event envelope requires eventId');
  }

  if (!isLifecycleEventType(envelope.eventType)) {
    throw new Error(`unknown lifecycle eventType ${JSON.stringify(envelope.eventType)}`);
  }

  if (envelope.occurredAt.trim().length === 0 || Number.isNaN(Date.parse(envelope.occurredAt))) {
    throw new Error('lifecycle event envelope requires valid occurredAt');
  }

  if (!isLifecycleSourceOwner(envelope.sourceOwner)) {
    throw new Error(`unknown lifecycle sourceOwner ${JSON.stringify(envelope.sourceOwner)}`);
  }

  if (envelope.subjectRef.trim().length === 0) {
    throw new Error('lifecycle event envelope requires subjectRef');
  }

  if (envelope.schemaVersion.trim().length === 0) {
    throw new Error('lifecycle event envelope requires schemaVersion');
  }

  if (envelope.idempotencyKey.trim().length === 0) {
    throw new Error('lifecycle event envelope requires idempotencyKey');
  }

  if (envelope.evidenceRefs.length === 0) {
    throw new Error('lifecycle event envelope requires evidenceRefs');
  }

  if (!envelope.evidenceRefs.every((evidenceRef) => evidenceRef.trim().length > 0)) {
    throw new Error('lifecycle event envelope evidenceRefs must be non-empty strings');
  }

  if (
    !envelope.payload ||
    typeof envelope.payload !== 'object' ||
    Array.isArray(envelope.payload)
  ) {
    throw new Error('lifecycle event envelope requires object payload');
  }
};
