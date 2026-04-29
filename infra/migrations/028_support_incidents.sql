CREATE TABLE IF NOT EXISTS polyphony_runtime.support_runbook_versions (
  runbook_id text PRIMARY KEY,
  incident_class text NOT NULL UNIQUE,
  doc_path text NOT NULL,
  version text NOT NULL,
  required_sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT support_runbook_versions_incident_class_check CHECK (
    incident_class IN (
      'runtime_availability',
      'operator_access',
      'reporting_freshness',
      'release_or_rollback',
      'model_readiness',
      'governance_or_safety_escalation',
      'support_process_gap'
    )
  ),
  CONSTRAINT support_runbook_versions_required_sections_array_check CHECK (
    jsonb_typeof(required_sections_json) = 'array'
  ),
  CONSTRAINT support_runbook_versions_source_refs_array_check CHECK (
    jsonb_typeof(source_refs_json) = 'array'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.support_incidents (
  support_incident_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  incident_class text NOT NULL,
  severity text NOT NULL,
  source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  report_run_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  release_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  operator_evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  escalation_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  closure_criteria_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  operator_notes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  closure_status text NOT NULL,
  closure_readiness_status text NOT NULL DEFAULT 'ready',
  closure_readiness_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  residual_risk text NULL,
  next_owner_ref text NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  closed_at timestamptz NULL,
  CONSTRAINT support_incidents_class_check CHECK (
    incident_class IN (
      'runtime_availability',
      'operator_access',
      'reporting_freshness',
      'release_or_rollback',
      'model_readiness',
      'governance_or_safety_escalation',
      'support_process_gap'
    )
  ),
  CONSTRAINT support_incidents_severity_check CHECK (severity IN ('warning', 'critical')),
  CONSTRAINT support_incidents_closure_status_check CHECK (
    closure_status IN ('open', 'blocked', 'resolved', 'transferred')
  ),
  CONSTRAINT support_incidents_closure_readiness_status_check CHECK (
    closure_readiness_status IN ('ready', 'degraded', 'blocked')
  ),
  CONSTRAINT support_incidents_source_refs_array_check CHECK (
    jsonb_typeof(source_refs_json) = 'array'
  ),
  CONSTRAINT support_incidents_report_refs_array_check CHECK (
    jsonb_typeof(report_run_refs_json) = 'array'
  ),
  CONSTRAINT support_incidents_release_refs_array_check CHECK (
    jsonb_typeof(release_refs_json) = 'array'
  ),
  CONSTRAINT support_incidents_operator_refs_array_check CHECK (
    jsonb_typeof(operator_evidence_refs_json) = 'array'
  ),
  CONSTRAINT support_incidents_action_refs_array_check CHECK (
    jsonb_typeof(action_refs_json) = 'array'
  ),
  CONSTRAINT support_incidents_escalation_refs_array_check CHECK (
    jsonb_typeof(escalation_refs_json) = 'array'
  ),
  CONSTRAINT support_incidents_closure_criteria_array_check CHECK (
    jsonb_typeof(closure_criteria_json) = 'array'
  ),
  CONSTRAINT support_incidents_operator_notes_array_check CHECK (
    jsonb_typeof(operator_notes_json) = 'array'
  ),
  CONSTRAINT support_incidents_closure_readiness_reasons_array_check CHECK (
    jsonb_typeof(closure_readiness_reasons_json) = 'array'
  ),
  CONSTRAINT support_incidents_terminal_closed_at_check CHECK (
    closure_status NOT IN ('resolved', 'transferred') OR closed_at IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.support_incident_update_requests (
  request_id text PRIMARY KEY,
  support_incident_id text NOT NULL REFERENCES polyphony_runtime.support_incidents (support_incident_id)
    ON DELETE CASCADE,
  normalized_request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text NULL,
  closure_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  CONSTRAINT support_incident_update_requests_status_check CHECK (
    status IN ('pending', 'applied', 'rejected')
  ),
  CONSTRAINT support_incident_update_requests_closure_reasons_array_check CHECK (
    jsonb_typeof(closure_reasons_json) = 'array'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.support_evidence_refs (
  evidence_ref_id text PRIMARY KEY,
  support_incident_id text NOT NULL REFERENCES polyphony_runtime.support_incidents (support_incident_id)
    ON DELETE CASCADE,
  owner_ref text NOT NULL,
  ref_kind text NOT NULL,
  ref text NOT NULL,
  freshness text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT support_evidence_refs_freshness_check CHECK (
    freshness IN ('fresh', 'degraded', 'stale', 'missing', 'unavailable')
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.support_action_records (
  action_ref text PRIMARY KEY,
  support_incident_id text NOT NULL REFERENCES polyphony_runtime.support_incidents (support_incident_id)
    ON DELETE CASCADE,
  mode text NOT NULL,
  owner_ref text NOT NULL,
  requested_action text NOT NULL,
  status text NOT NULL,
  evidence_ref text NULL,
  recorded_at timestamptz NOT NULL,
  CONSTRAINT support_action_records_mode_check CHECK (mode IN ('owner_routed', 'human_only')),
  CONSTRAINT support_action_records_status_check CHECK (
    status IN ('requested', 'unavailable', 'succeeded', 'failed', 'documented')
  )
);

CREATE INDEX IF NOT EXISTS support_incidents_class_updated_idx
  ON polyphony_runtime.support_incidents (incident_class, updated_at DESC);

CREATE INDEX IF NOT EXISTS support_incidents_closure_updated_idx
  ON polyphony_runtime.support_incidents (closure_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS support_evidence_refs_incident_idx
  ON polyphony_runtime.support_evidence_refs (support_incident_id, owner_ref);

CREATE INDEX IF NOT EXISTS support_action_records_incident_idx
  ON polyphony_runtime.support_action_records (support_incident_id, recorded_at DESC);
