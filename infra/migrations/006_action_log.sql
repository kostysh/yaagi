CREATE TABLE IF NOT EXISTS polyphony_runtime.action_log (
  action_id text PRIMARY KEY,
  tick_id text NOT NULL REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE CASCADE,
  action_kind text NOT NULL,
  tool_name text,
  parameters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  boundary_check_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_log_kind_check CHECK (
    action_kind IN ('tool_call', 'schedule_job', 'review_request', 'conscious_inaction')
  )
);

CREATE INDEX IF NOT EXISTS action_log_tick_created_idx
  ON polyphony_runtime.action_log (tick_id, created_at DESC);

CREATE INDEX IF NOT EXISTS action_log_kind_created_idx
  ON polyphony_runtime.action_log (action_kind, created_at DESC);
