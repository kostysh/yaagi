CREATE TABLE IF NOT EXISTS polyphony_runtime.lifecycle_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  source_owner text NOT NULL,
  subject_ref text NOT NULL,
  schema_version text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lifecycle_events_type_check CHECK (
    event_type IN (
      'lifecycle.rollback_incident.recorded',
      'lifecycle.shutdown.requested',
      'lifecycle.shutdown.completed',
      'consolidation.transition.accepted',
      'consolidation.transition.rejected',
      'retention.compaction.completed'
    )
  ),
  CONSTRAINT lifecycle_events_source_owner_check CHECK (
    source_owner IN (
      'F-0003',
      'F-0004',
      'F-0011',
      'F-0012',
      'F-0016',
      'F-0017',
      'F-0019',
      'CF-015',
      'CF-025'
    )
  ),
  CONSTRAINT lifecycle_events_payload_json_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  ),
  CONSTRAINT lifecycle_events_evidence_refs_json_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  ),
  CONSTRAINT lifecycle_events_required_refs_check CHECK (
    jsonb_array_length(evidence_refs_json) > 0
  )
);

CREATE INDEX IF NOT EXISTS lifecycle_events_type_idx
  ON polyphony_runtime.lifecycle_events (event_type, occurred_at DESC, event_id DESC);

CREATE INDEX IF NOT EXISTS lifecycle_events_subject_ref_idx
  ON polyphony_runtime.lifecycle_events (subject_ref, occurred_at DESC, event_id DESC);

CREATE INDEX IF NOT EXISTS lifecycle_events_source_owner_idx
  ON polyphony_runtime.lifecycle_events (source_owner, occurred_at DESC, event_id DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.consolidation_transitions (
  transition_id text PRIMARY KEY,
  transition_class text NOT NULL,
  status text NOT NULL,
  target_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  projection_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason text,
  lifecycle_event_id text NOT NULL UNIQUE
    REFERENCES polyphony_runtime.lifecycle_events (event_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consolidation_transitions_class_check CHECK (
    transition_class IN (
      'promote_memetic_unit',
      'merge_memetic_units',
      'split_memetic_unit',
      'quarantine_memetic_unit',
      'retire_memetic_unit',
      'compact_field_journal',
      'summarize_repeated_episodes',
      'prepare_dataset_candidate',
      'retire_stale_tension'
    )
  ),
  CONSTRAINT consolidation_transitions_status_check CHECK (status IN ('accepted', 'rejected')),
  CONSTRAINT consolidation_transitions_target_refs_json_array_check CHECK (
    jsonb_typeof(target_refs_json) = 'array'
  ),
  CONSTRAINT consolidation_transitions_source_refs_json_array_check CHECK (
    jsonb_typeof(source_refs_json) = 'array'
  ),
  CONSTRAINT consolidation_transitions_evidence_refs_json_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  ),
  CONSTRAINT consolidation_transitions_projection_json_object_check CHECK (
    jsonb_typeof(projection_json) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS consolidation_transitions_class_idx
  ON polyphony_runtime.consolidation_transitions (transition_class, created_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.rollback_incidents (
  rollback_incident_id text PRIMARY KEY,
  lifecycle_event_id text NOT NULL UNIQUE
    REFERENCES polyphony_runtime.lifecycle_events (event_id) ON DELETE RESTRICT,
  incident_kind text NOT NULL,
  severity text NOT NULL,
  rollback_ref text,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rollback_incidents_severity_check CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT rollback_incidents_evidence_refs_json_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS rollback_incidents_recorded_at_idx
  ON polyphony_runtime.rollback_incidents (recorded_at DESC, rollback_incident_id DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.graceful_shutdown_events (
  shutdown_event_id text PRIMARY KEY,
  lifecycle_event_id text NOT NULL UNIQUE
    REFERENCES polyphony_runtime.lifecycle_events (event_id) ON DELETE RESTRICT,
  shutdown_state text NOT NULL,
  reason text NOT NULL,
  admitted_in_flight_work_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  terminal_tick_outcome_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  flushed_buffer_result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  open_concerns_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT graceful_shutdown_events_state_check CHECK (
    shutdown_state IN ('shutting_down', 'completed')
  ),
  CONSTRAINT graceful_shutdown_events_admitted_work_array_check CHECK (
    jsonb_typeof(admitted_in_flight_work_json) = 'array'
  ),
  CONSTRAINT graceful_shutdown_events_terminal_outcome_object_check CHECK (
    jsonb_typeof(terminal_tick_outcome_json) = 'object'
  ),
  CONSTRAINT graceful_shutdown_events_flushed_result_object_check CHECK (
    jsonb_typeof(flushed_buffer_result_json) = 'object'
  ),
  CONSTRAINT graceful_shutdown_events_open_concerns_array_check CHECK (
    jsonb_typeof(open_concerns_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS graceful_shutdown_events_recorded_at_idx
  ON polyphony_runtime.graceful_shutdown_events (recorded_at DESC, shutdown_event_id DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.retention_compaction_runs (
  compaction_run_id text PRIMARY KEY,
  lifecycle_event_id text NOT NULL UNIQUE
    REFERENCES polyphony_runtime.lifecycle_events (event_id) ON DELETE RESTRICT,
  policy_kind text NOT NULL,
  mode text NOT NULL,
  target_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  preserved_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_trace_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject_state_schema_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retention_compaction_runs_mode_check CHECK (
    mode IN ('non_destructive', 'aggregate_only', 'destructive_allowed')
  ),
  CONSTRAINT retention_compaction_runs_target_refs_json_array_check CHECK (
    jsonb_typeof(target_refs_json) = 'array'
  ),
  CONSTRAINT retention_compaction_runs_source_refs_json_array_check CHECK (
    jsonb_typeof(source_refs_json) = 'array'
  ),
  CONSTRAINT retention_compaction_runs_preserved_refs_json_array_check CHECK (
    jsonb_typeof(preserved_refs_json) = 'array'
  ),
  CONSTRAINT retention_compaction_runs_deleted_trace_refs_json_array_check CHECK (
    jsonb_typeof(deleted_trace_refs_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS retention_compaction_runs_created_at_idx
  ON polyphony_runtime.retention_compaction_runs (created_at DESC, compaction_run_id DESC);
