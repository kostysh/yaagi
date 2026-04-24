CREATE TABLE IF NOT EXISTS polyphony_runtime.policy_profiles (
  profile_id text NOT NULL,
  profile_version text NOT NULL,
  status text NOT NULL,
  governed_scopes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  activation_requirements_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (profile_id, profile_version),
  CONSTRAINT policy_profiles_status_check CHECK (
    status IN ('draft', 'active', 'retired', 'blocked')
  ),
  CONSTRAINT policy_profiles_governed_scopes_array_check CHECK (
    jsonb_typeof(governed_scopes_json) = 'array'
  ),
  CONSTRAINT policy_profiles_activation_requirements_object_check CHECK (
    jsonb_typeof(activation_requirements_json) = 'object'
  ),
  CONSTRAINT policy_profiles_rules_object_check CHECK (
    jsonb_typeof(rules_json) = 'object'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.policy_profile_activations (
  activation_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  profile_id text NOT NULL,
  profile_version text NOT NULL,
  scope text NOT NULL,
  decision text NOT NULL,
  reason_code text NOT NULL,
  actor_ref text NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  activated_at timestamptz NULL,
  deactivated_at timestamptz NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT policy_profile_activations_scope_check CHECK (
    scope IN ('consultant_admission', 'perception_intake', 'human_gate', 'phase6_autonomy')
  ),
  CONSTRAINT policy_profile_activations_decision_check CHECK (
    decision IN ('activate', 'deactivate', 'refuse')
  ),
  CONSTRAINT policy_profile_activations_evidence_refs_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.consultant_admission_decisions (
  decision_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  profile_id text NULL,
  profile_version text NULL,
  consultant_kind text NOT NULL,
  target_scope text NOT NULL,
  decision text NOT NULL,
  reason_code text NOT NULL,
  selected_model_profile_id text NULL,
  health_ref text NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  CONSTRAINT consultant_admission_decisions_profile_fk FOREIGN KEY (profile_id, profile_version)
    REFERENCES polyphony_runtime.policy_profiles (profile_id, profile_version)
    ON DELETE RESTRICT,
  CONSTRAINT consultant_admission_decisions_decision_check CHECK (
    decision IN ('allow', 'deny', 'refusal')
  ),
  CONSTRAINT consultant_admission_decisions_evidence_refs_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  ),
  CONSTRAINT consultant_admission_decisions_payload_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.perception_policy_decisions (
  decision_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  stimulus_id text NOT NULL,
  source_kind text NOT NULL,
  priority text NOT NULL,
  profile_id text NULL,
  profile_version text NULL,
  outcome text NOT NULL,
  reason_code text NOT NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  CONSTRAINT perception_policy_decisions_profile_fk FOREIGN KEY (profile_id, profile_version)
    REFERENCES polyphony_runtime.policy_profiles (profile_id, profile_version)
    ON DELETE RESTRICT,
  CONSTRAINT perception_policy_decisions_source_kind_check CHECK (
    source_kind IN ('http', 'file', 'telegram', 'scheduler', 'resource', 'system')
  ),
  CONSTRAINT perception_policy_decisions_priority_check CHECK (
    priority IN ('low', 'normal', 'high', 'critical')
  ),
  CONSTRAINT perception_policy_decisions_outcome_check CHECK (
    outcome IN ('accepted', 'degraded', 'refused', 'human_gated')
  ),
  CONSTRAINT perception_policy_decisions_evidence_refs_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  ),
  CONSTRAINT perception_policy_decisions_payload_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.phase6_governance_events (
  event_id text PRIMARY KEY,
  event_kind text NOT NULL,
  source_ref text NOT NULL,
  profile_id text NULL,
  profile_version text NULL,
  decision_ref text NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  CONSTRAINT phase6_governance_events_profile_fk FOREIGN KEY (profile_id, profile_version)
    REFERENCES polyphony_runtime.policy_profiles (profile_id, profile_version)
    ON DELETE RESTRICT,
  CONSTRAINT phase6_governance_events_kind_check CHECK (
    event_kind IN (
      'policy_profile_registered',
      'policy_activation_decided',
      'consultant_admission_decided',
      'perception_policy_decided',
      'governance_evidence_recorded'
    )
  ),
  CONSTRAINT phase6_governance_events_payload_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS policy_profiles_status_scope_idx
  ON polyphony_runtime.policy_profiles (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS policy_profile_activations_scope_created_idx
  ON polyphony_runtime.policy_profile_activations (scope, created_at DESC);

CREATE INDEX IF NOT EXISTS consultant_admission_decisions_target_created_idx
  ON polyphony_runtime.consultant_admission_decisions (target_scope, created_at DESC);

CREATE INDEX IF NOT EXISTS perception_policy_decisions_stimulus_idx
  ON polyphony_runtime.perception_policy_decisions (stimulus_id, created_at DESC);

CREATE INDEX IF NOT EXISTS phase6_governance_events_created_idx
  ON polyphony_runtime.phase6_governance_events (created_at DESC, event_id DESC);
