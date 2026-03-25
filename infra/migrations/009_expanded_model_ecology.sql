ALTER TABLE polyphony_runtime.model_registry
  ADD COLUMN IF NOT EXISTS service_id text;

UPDATE polyphony_runtime.model_registry
SET service_id = CASE
  WHEN role IN ('reflex', 'deliberation', 'reflection') THEN 'vllm-fast'
  WHEN role IN ('code', 'safety') THEN 'vllm-deep'
  WHEN role IN ('embedding', 'reranker', 'classifier') THEN 'vllm-pool'
  ELSE 'vllm-fast'
END
WHERE service_id IS NULL;

ALTER TABLE polyphony_runtime.model_registry
  ALTER COLUMN service_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS polyphony_runtime.model_profile_health (
  model_profile_id text PRIMARY KEY
    REFERENCES polyphony_runtime.model_registry (model_profile_id) ON DELETE CASCADE,
  service_id text NOT NULL,
  availability text NOT NULL,
  quarantine_state text NOT NULL,
  healthy boolean,
  error_rate double precision,
  latency_ms_p95 double precision,
  checked_at timestamptz NOT NULL,
  source_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_profile_health_availability_check
    CHECK (availability IN ('available', 'degraded', 'unavailable')),
  CONSTRAINT model_profile_health_quarantine_state_check
    CHECK (quarantine_state IN ('clear', 'active'))
);

CREATE INDEX IF NOT EXISTS model_profile_health_service_availability_idx
  ON polyphony_runtime.model_profile_health (service_id, availability);

CREATE INDEX IF NOT EXISTS model_profile_health_quarantine_idx
  ON polyphony_runtime.model_profile_health (quarantine_state, checked_at desc);

CREATE TABLE IF NOT EXISTS polyphony_runtime.model_fallback_links (
  model_profile_id text NOT NULL
    REFERENCES polyphony_runtime.model_registry (model_profile_id) ON DELETE CASCADE,
  fallback_target_profile_id text
    REFERENCES polyphony_runtime.model_registry (model_profile_id) ON DELETE SET NULL,
  link_kind text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model_profile_id, link_kind),
  CONSTRAINT model_fallback_links_kind_check
    CHECK (link_kind IN ('predecessor', 'degraded_fallback'))
);

CREATE INDEX IF NOT EXISTS model_fallback_links_target_idx
  ON polyphony_runtime.model_fallback_links (fallback_target_profile_id);
