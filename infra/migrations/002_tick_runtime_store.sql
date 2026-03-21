CREATE SCHEMA IF NOT EXISTS polyphony_runtime;

CREATE TABLE IF NOT EXISTS polyphony_runtime.ticks (
  tick_id text PRIMARY KEY,
  agent_id text NOT NULL DEFAULT 'polyphony-core',
  request_id text NOT NULL UNIQUE,
  tick_kind text NOT NULL,
  trigger_kind text NOT NULL,
  status text NOT NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  lease_owner text NOT NULL DEFAULT 'core',
  lease_expires_at timestamptz NOT NULL,
  request_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  continuity_flags_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_coalition_id text,
  selected_model_profile_id text,
  action_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticks_tick_kind_check CHECK (
    tick_kind IN (
      'reactive',
      'deliberative',
      'contemplative',
      'consolidation',
      'developmental',
      'wake'
    )
  ),
  CONSTRAINT ticks_trigger_kind_check CHECK (trigger_kind IN ('boot', 'scheduler', 'system')),
  CONSTRAINT ticks_status_check CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
  CONSTRAINT ticks_ended_after_start_check CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT ticks_lease_after_start_check CHECK (lease_expires_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS ticks_one_active_per_agent_idx
  ON polyphony_runtime.ticks (agent_id)
  WHERE status = 'started' AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS ticks_reclaim_idx
  ON polyphony_runtime.ticks (lease_expires_at)
  WHERE status = 'started' AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS ticks_agent_started_idx
  ON polyphony_runtime.ticks (agent_id, started_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.episodes (
  episode_id text PRIMARY KEY,
  tick_id text NOT NULL UNIQUE REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE CASCADE,
  summary text NOT NULL,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS episodes_created_at_idx
  ON polyphony_runtime.episodes (created_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.timeline_events (
  sequence_id bigserial PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  subject_ref text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timeline_events_subject_ref_idx
  ON polyphony_runtime.timeline_events (subject_ref, occurred_at DESC);

CREATE INDEX IF NOT EXISTS timeline_events_type_idx
  ON polyphony_runtime.timeline_events (event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.agent_state (
  id integer PRIMARY KEY DEFAULT 1,
  agent_id text NOT NULL DEFAULT 'polyphony-core',
  mode text NOT NULL DEFAULT 'inactive',
  schema_version text,
  boot_state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_tick_id text REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE SET NULL,
  current_model_profile_id text,
  last_stable_snapshot_id text,
  development_freeze boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_state_singleton_check CHECK (id = 1),
  CONSTRAINT agent_state_mode_check CHECK (mode IN ('inactive', 'normal', 'degraded', 'recovery'))
);

INSERT INTO polyphony_runtime.agent_state (id, agent_id)
VALUES (1, 'polyphony-core')
ON CONFLICT (id) DO NOTHING;
