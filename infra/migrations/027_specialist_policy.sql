CREATE TABLE IF NOT EXISTS polyphony_runtime.specialist_organs (
  specialist_id text PRIMARY KEY,
  task_signature text NOT NULL,
  capability text NOT NULL,
  workshop_candidate_id text NOT NULL,
  promotion_package_ref text NOT NULL,
  model_profile_id text NOT NULL,
  service_id text NOT NULL,
  predecessor_profile_id text NULL,
  rollback_target_profile_id text NULL,
  fallback_target_profile_id text NULL,
  stage text NOT NULL,
  status_reason text NOT NULL,
  current_policy_id text NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT specialist_organs_stage_check CHECK (
    stage IN ('candidate', 'shadow', 'limited-active', 'active', 'stable', 'retiring', 'retired')
  ),
  CONSTRAINT specialist_organs_live_rollback_check CHECK (
    stage NOT IN ('limited-active', 'active', 'stable') OR rollback_target_profile_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.specialist_rollout_policies (
  policy_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  specialist_id text NOT NULL REFERENCES polyphony_runtime.specialist_organs (specialist_id)
    ON DELETE RESTRICT,
  governed_scope text NOT NULL,
  allowed_stage text NOT NULL,
  traffic_limit integer NULL,
  required_evidence_classes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  health_max_age_ms integer NULL,
  fallback_target_profile_id text NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL,
  CONSTRAINT specialist_rollout_policies_stage_check CHECK (
    allowed_stage IN ('candidate', 'shadow', 'limited-active', 'active', 'stable', 'retiring', 'retired')
  ),
  CONSTRAINT specialist_rollout_policies_traffic_positive_check CHECK (
    traffic_limit IS NULL OR traffic_limit > 0
  ),
  CONSTRAINT specialist_rollout_policies_limited_active_limit_check CHECK (
    allowed_stage <> 'limited-active' OR traffic_limit IS NOT NULL
  ),
  CONSTRAINT specialist_rollout_policies_health_age_positive_check CHECK (
    health_max_age_ms IS NULL OR health_max_age_ms > 0
  ),
  CONSTRAINT specialist_rollout_policies_evidence_classes_array_check CHECK (
    jsonb_typeof(required_evidence_classes_json) = 'array'
  ),
  CONSTRAINT specialist_rollout_policies_evidence_refs_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.specialist_rollout_events (
  event_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  policy_id text NOT NULL REFERENCES polyphony_runtime.specialist_rollout_policies (policy_id)
    ON DELETE RESTRICT,
  specialist_id text NOT NULL REFERENCES polyphony_runtime.specialist_organs (specialist_id)
    ON DELETE RESTRICT,
  from_stage text NULL,
  to_stage text NOT NULL,
  decision text NOT NULL,
  reason_code text NOT NULL,
  actor_ref text NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL,
  CONSTRAINT specialist_rollout_events_from_stage_check CHECK (
    from_stage IS NULL OR from_stage IN (
      'candidate',
      'shadow',
      'limited-active',
      'active',
      'stable',
      'retiring',
      'retired'
    )
  ),
  CONSTRAINT specialist_rollout_events_to_stage_check CHECK (
    to_stage IN ('candidate', 'shadow', 'limited-active', 'active', 'stable', 'retiring', 'retired')
  ),
  CONSTRAINT specialist_rollout_events_decision_check CHECK (
    decision IN ('recorded', 'refused')
  ),
  CONSTRAINT specialist_rollout_events_evidence_refs_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.specialist_admission_decisions (
  decision_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  specialist_id text NOT NULL,
  task_signature text NOT NULL,
  selected_model_profile_id text NULL,
  stage text NULL,
  decision text NOT NULL,
  reason_code text NOT NULL,
  fallback_target_profile_id text NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  CONSTRAINT specialist_admission_decisions_stage_check CHECK (
    stage IS NULL OR stage IN (
      'candidate',
      'shadow',
      'limited-active',
      'active',
      'stable',
      'retiring',
      'retired'
    )
  ),
  CONSTRAINT specialist_admission_decisions_decision_check CHECK (
    decision IN ('allow', 'refusal')
  ),
  CONSTRAINT specialist_admission_decisions_evidence_refs_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  ),
  CONSTRAINT specialist_admission_decisions_payload_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.specialist_retirement_decisions (
  retirement_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  specialist_id text NOT NULL REFERENCES polyphony_runtime.specialist_organs (specialist_id)
    ON DELETE RESTRICT,
  trigger_kind text NOT NULL,
  previous_stage text NOT NULL,
  replacement_specialist_id text NULL,
  fallback_target_profile_id text NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT specialist_retirement_trigger_check CHECK (
    trigger_kind IN (
      'degraded',
      'stale',
      'cost_ineffective',
      'unsafe',
      'rollback_triggered',
      'superseded',
      'operator_request'
    )
  ),
  CONSTRAINT specialist_retirement_previous_stage_check CHECK (
    previous_stage IN ('candidate', 'shadow', 'limited-active', 'active', 'stable', 'retiring', 'retired')
  ),
  CONSTRAINT specialist_retirement_evidence_refs_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS specialist_organs_task_stage_idx
  ON polyphony_runtime.specialist_organs (task_signature, stage);

CREATE INDEX IF NOT EXISTS specialist_rollout_policies_specialist_created_idx
  ON polyphony_runtime.specialist_rollout_policies (specialist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS specialist_rollout_events_specialist_created_idx
  ON polyphony_runtime.specialist_rollout_events (specialist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS specialist_admission_decisions_specialist_created_idx
  ON polyphony_runtime.specialist_admission_decisions (specialist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS specialist_retirement_decisions_specialist_created_idx
  ON polyphony_runtime.specialist_retirement_decisions (specialist_id, created_at DESC);
