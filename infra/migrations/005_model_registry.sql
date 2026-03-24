CREATE TABLE IF NOT EXISTS polyphony_runtime.model_registry (
  model_profile_id text PRIMARY KEY,
  role text NOT NULL,
  endpoint text NOT NULL,
  artifact_uri text,
  base_model text NOT NULL,
  adapter_of text REFERENCES polyphony_runtime.model_registry (model_profile_id) ON DELETE SET NULL,
  capabilities_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_registry_role_check CHECK (
    role IN (
      'reflex',
      'deliberation',
      'reflection',
      'code',
      'embedding',
      'reranker',
      'classifier',
      'safety'
    )
  ),
  CONSTRAINT model_registry_status_check CHECK (status IN ('active', 'degraded', 'disabled'))
);

CREATE INDEX IF NOT EXISTS model_registry_role_status_idx
  ON polyphony_runtime.model_registry (role, status);

CREATE INDEX IF NOT EXISTS model_registry_status_idx
  ON polyphony_runtime.model_registry (status, model_profile_id);
