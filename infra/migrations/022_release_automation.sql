CREATE TABLE IF NOT EXISTS polyphony_runtime.release_requests (
  request_id text PRIMARY KEY,
  normalized_request_hash text NOT NULL,
  target_environment text NOT NULL,
  git_ref text NOT NULL,
  rollback_target_ref text NOT NULL,
  actor_ref text NOT NULL,
  source text NOT NULL,
  requested_action text NOT NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT release_requests_environment_check CHECK (
    target_environment IN ('local', 'release_cell')
  ),
  CONSTRAINT release_requests_source_check CHECK (
    source IN ('cli', 'operator_api', 'ci')
  ),
  CONSTRAINT release_requests_action_check CHECK (
    requested_action IN ('deploy', 'rollback')
  ),
  CONSTRAINT release_requests_evidence_refs_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.rollback_plans (
  rollback_plan_id text PRIMARY KEY,
  release_request_id text NOT NULL REFERENCES polyphony_runtime.release_requests (request_id)
    ON DELETE RESTRICT,
  deploy_attempt_id text NULL,
  rollback_target_ref text NOT NULL,
  required_evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_mode text NOT NULL,
  preflight_status text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT rollback_plans_execution_mode_check CHECK (
    execution_mode IN ('automatic', 'manual')
  ),
  CONSTRAINT rollback_plans_preflight_status_check CHECK (
    preflight_status IN ('ready', 'blocked')
  ),
  CONSTRAINT rollback_plans_required_evidence_array_check CHECK (
    jsonb_typeof(required_evidence_refs_json) = 'array'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.deploy_attempts (
  deploy_attempt_id text PRIMARY KEY,
  release_request_id text NOT NULL REFERENCES polyphony_runtime.release_requests (request_id)
    ON DELETE RESTRICT,
  rollback_plan_id text NOT NULL REFERENCES polyphony_runtime.rollback_plans (rollback_plan_id)
    ON DELETE RESTRICT,
  target_environment text NOT NULL,
  deployment_identity text NOT NULL,
  migration_state text NOT NULL,
  status text NOT NULL,
  failure_reason text NULL,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT deploy_attempts_environment_check CHECK (
    target_environment IN ('local', 'release_cell')
  ),
  CONSTRAINT deploy_attempts_status_check CHECK (
    status IN ('prepared', 'running', 'succeeded', 'smoke_failed', 'rolled_back', 'failed')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rollback_plans_deploy_attempt_fk'
  ) THEN
    ALTER TABLE polyphony_runtime.rollback_plans
      ADD CONSTRAINT rollback_plans_deploy_attempt_fk
      FOREIGN KEY (deploy_attempt_id)
      REFERENCES polyphony_runtime.deploy_attempts (deploy_attempt_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS polyphony_runtime.release_evidence (
  evidence_bundle_id text PRIMARY KEY,
  release_request_id text NOT NULL REFERENCES polyphony_runtime.release_requests (request_id)
    ON DELETE RESTRICT,
  deploy_attempt_id text NOT NULL REFERENCES polyphony_runtime.deploy_attempts (deploy_attempt_id)
    ON DELETE RESTRICT,
  commit_ref text NOT NULL,
  deployment_identity text NOT NULL,
  migration_state text NOT NULL,
  smoke_on_deploy_result_json jsonb NOT NULL,
  model_serving_readiness_ref text NOT NULL,
  governor_evidence_ref text NOT NULL,
  lifecycle_rollback_target_ref text NOT NULL,
  diagnostic_report_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_artifact_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  materialized_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT release_evidence_smoke_result_object_check CHECK (
    jsonb_typeof(smoke_on_deploy_result_json) = 'object'
  ),
  CONSTRAINT release_evidence_diagnostic_refs_array_check CHECK (
    jsonb_typeof(diagnostic_report_refs_json) = 'array'
  ),
  CONSTRAINT release_evidence_file_artifact_refs_array_check CHECK (
    jsonb_typeof(file_artifact_refs_json) = 'array'
  )
);

CREATE TABLE IF NOT EXISTS polyphony_runtime.rollback_executions (
  rollback_execution_id text PRIMARY KEY,
  rollback_plan_id text NOT NULL REFERENCES polyphony_runtime.rollback_plans (rollback_plan_id)
    ON DELETE RESTRICT,
  deploy_attempt_id text NOT NULL REFERENCES polyphony_runtime.deploy_attempts (deploy_attempt_id)
    ON DELETE RESTRICT,
  trigger text NOT NULL,
  status text NOT NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  diagnostic_report_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  executed_at timestamptz NOT NULL,
  failure_reason text NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT rollback_executions_plan_deploy_unique UNIQUE (rollback_plan_id, deploy_attempt_id),
  CONSTRAINT rollback_executions_trigger_check CHECK (
    trigger IN ('auto_smoke_failure', 'operator_manual', 'ci_manual')
  ),
  CONSTRAINT rollback_executions_status_check CHECK (
    status IN ('running', 'succeeded', 'failed', 'critical_failure')
  ),
  CONSTRAINT rollback_executions_evidence_refs_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  ),
  CONSTRAINT rollback_executions_diagnostic_refs_array_check CHECK (
    jsonb_typeof(diagnostic_report_refs_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS release_requests_environment_created_idx
  ON polyphony_runtime.release_requests (target_environment, created_at DESC);

CREATE INDEX IF NOT EXISTS rollback_plans_request_created_idx
  ON polyphony_runtime.rollback_plans (release_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS deploy_attempts_request_created_idx
  ON polyphony_runtime.deploy_attempts (release_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS release_evidence_attempt_created_idx
  ON polyphony_runtime.release_evidence (deploy_attempt_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rollback_executions_attempt_created_idx
  ON polyphony_runtime.rollback_executions (deploy_attempt_id, created_at DESC);
