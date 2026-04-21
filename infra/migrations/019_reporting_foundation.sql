CREATE TABLE IF NOT EXISTS polyphony_runtime.report_runs (
  report_run_id text PRIMARY KEY,
  report_family text NOT NULL,
  source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_owner_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_snapshot_signature text NOT NULL,
  materialized_at timestamptz NOT NULL,
  availability_status text NOT NULL,
  schema_version text NOT NULL,
  publication_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_runs_family_check CHECK (
    report_family IN (
      'identity_continuity',
      'model_health',
      'stable_snapshot_inventory',
      'development_diagnostics',
      'lifecycle_diagnostics'
    )
  ),
  CONSTRAINT report_runs_source_refs_json_array_check CHECK (
    jsonb_typeof(source_refs_json) = 'array'
  ),
  CONSTRAINT report_runs_source_owner_refs_json_array_check CHECK (
    jsonb_typeof(source_owner_refs_json) = 'array'
  ),
  CONSTRAINT report_runs_source_refs_required_check CHECK (
    jsonb_array_length(source_refs_json) > 0
  ),
  CONSTRAINT report_runs_source_owner_refs_required_check CHECK (
    jsonb_array_length(source_owner_refs_json) > 0
  ),
  CONSTRAINT report_runs_availability_status_check CHECK (
    availability_status IN ('fresh', 'degraded', 'not_evaluable', 'unavailable')
  ),
  CONSTRAINT report_runs_publication_json_object_check CHECK (
    jsonb_typeof(publication_json) = 'object'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS report_runs_family_snapshot_signature_uidx
  ON polyphony_runtime.report_runs (report_family, source_snapshot_signature);

CREATE INDEX IF NOT EXISTS report_runs_family_materialized_idx
  ON polyphony_runtime.report_runs (report_family, materialized_at DESC, report_run_id DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.identity_continuity_reports (
  report_run_id text PRIMARY KEY
    REFERENCES polyphony_runtime.report_runs (report_run_id) ON DELETE CASCADE,
  runtime_mode text NOT NULL,
  current_tick_ref text,
  last_stable_snapshot_ref text,
  recent_recovery_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability_status text NOT NULL,
  materialized_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identity_continuity_reports_runtime_mode_check CHECK (
    runtime_mode IN ('booting', 'live', 'recovery', 'degraded', 'stopped')
  ),
  CONSTRAINT identity_continuity_reports_recent_recovery_refs_array_check CHECK (
    jsonb_typeof(recent_recovery_refs_json) = 'array'
  ),
  CONSTRAINT identity_continuity_reports_availability_check CHECK (
    availability_status IN ('fresh', 'degraded', 'not_evaluable', 'unavailable')
  )
);

CREATE INDEX IF NOT EXISTS identity_continuity_reports_materialized_idx
  ON polyphony_runtime.identity_continuity_reports (materialized_at DESC, report_run_id DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.model_health_reports (
  report_row_id text PRIMARY KEY,
  report_run_id text NOT NULL
    REFERENCES polyphony_runtime.report_runs (report_run_id) ON DELETE CASCADE,
  organ_id text NOT NULL,
  profile_id text,
  health_status text NOT NULL,
  error_rate numeric(10,4),
  fallback_ref text,
  source_surface_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability_status text NOT NULL,
  materialized_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_health_reports_health_status_check CHECK (
    health_status IN ('healthy', 'degraded', 'unavailable')
  ),
  CONSTRAINT model_health_reports_source_surface_refs_array_check CHECK (
    jsonb_typeof(source_surface_refs_json) = 'array'
  ),
  CONSTRAINT model_health_reports_availability_check CHECK (
    availability_status IN ('fresh', 'degraded', 'not_evaluable', 'unavailable')
  )
);

CREATE INDEX IF NOT EXISTS model_health_reports_run_idx
  ON polyphony_runtime.model_health_reports (report_run_id, organ_id, profile_id);

CREATE INDEX IF NOT EXISTS model_health_reports_materialized_idx
  ON polyphony_runtime.model_health_reports (materialized_at DESC, organ_id, profile_id);

CREATE TABLE IF NOT EXISTS polyphony_runtime.stable_snapshot_inventory_reports (
  report_run_id text PRIMARY KEY
    REFERENCES polyphony_runtime.report_runs (report_run_id) ON DELETE CASCADE,
  latest_stable_snapshot_ref text,
  total_snapshots integer NOT NULL DEFAULT 0,
  snapshots_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability_status text NOT NULL,
  materialized_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stable_snapshot_inventory_reports_total_snapshots_non_negative_check CHECK (
    total_snapshots >= 0
  ),
  CONSTRAINT stable_snapshot_inventory_reports_snapshots_object_check CHECK (
    jsonb_typeof(snapshots_json) = 'array'
  ),
  CONSTRAINT stable_snapshot_inventory_reports_availability_check CHECK (
    availability_status IN ('fresh', 'degraded', 'not_evaluable', 'unavailable')
  )
);

CREATE INDEX IF NOT EXISTS stable_snapshot_inventory_reports_materialized_idx
  ON polyphony_runtime.stable_snapshot_inventory_reports (materialized_at DESC, report_run_id DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.development_diagnostics_reports (
  report_run_id text PRIMARY KEY
    REFERENCES polyphony_runtime.report_runs (report_run_id) ON DELETE CASCADE,
  development_freeze_active boolean NOT NULL DEFAULT false,
  ledger_entry_count_last_30d integer NOT NULL DEFAULT 0,
  proposal_count_last_30d integer NOT NULL DEFAULT 0,
  recent_ledger_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  recent_failed_action_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability_status text NOT NULL,
  materialized_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_diagnostics_reports_ledger_count_non_negative_check CHECK (
    ledger_entry_count_last_30d >= 0
  ),
  CONSTRAINT development_diagnostics_reports_proposal_count_non_negative_check CHECK (
    proposal_count_last_30d >= 0
  ),
  CONSTRAINT development_diagnostics_reports_recent_ledger_refs_array_check CHECK (
    jsonb_typeof(recent_ledger_refs_json) = 'array'
  ),
  CONSTRAINT development_diagnostics_reports_recent_failed_action_refs_array_check CHECK (
    jsonb_typeof(recent_failed_action_refs_json) = 'array'
  ),
  CONSTRAINT development_diagnostics_reports_availability_check CHECK (
    availability_status IN ('fresh', 'degraded', 'not_evaluable', 'unavailable')
  )
);

CREATE INDEX IF NOT EXISTS development_diagnostics_reports_materialized_idx
  ON polyphony_runtime.development_diagnostics_reports (materialized_at DESC, report_run_id DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.lifecycle_diagnostics_reports (
  report_run_id text PRIMARY KEY
    REFERENCES polyphony_runtime.report_runs (report_run_id) ON DELETE CASCADE,
  rollback_incident_count_last_30d integer NOT NULL DEFAULT 0,
  graceful_shutdown_count_last_30d integer NOT NULL DEFAULT 0,
  recent_rollback_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  recent_graceful_shutdown_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  recent_compaction_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability_status text NOT NULL,
  materialized_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lifecycle_diagnostics_reports_rollback_count_non_negative_check CHECK (
    rollback_incident_count_last_30d >= 0
  ),
  CONSTRAINT lifecycle_diagnostics_reports_shutdown_count_non_negative_check CHECK (
    graceful_shutdown_count_last_30d >= 0
  ),
  CONSTRAINT lifecycle_diagnostics_reports_recent_rollback_refs_array_check CHECK (
    jsonb_typeof(recent_rollback_refs_json) = 'array'
  ),
  CONSTRAINT lifecycle_diagnostics_reports_recent_graceful_shutdown_refs_array_check CHECK (
    jsonb_typeof(recent_graceful_shutdown_refs_json) = 'array'
  ),
  CONSTRAINT lifecycle_diagnostics_reports_recent_compaction_refs_array_check CHECK (
    jsonb_typeof(recent_compaction_refs_json) = 'array'
  ),
  CONSTRAINT lifecycle_diagnostics_reports_availability_check CHECK (
    availability_status IN ('fresh', 'degraded', 'not_evaluable', 'unavailable')
  )
);

CREATE INDEX IF NOT EXISTS lifecycle_diagnostics_reports_materialized_idx
  ON polyphony_runtime.lifecycle_diagnostics_reports (materialized_at DESC, report_run_id DESC);
