CREATE TABLE IF NOT EXISTS polyphony_runtime.stimulus_inbox (
  stimulus_id text PRIMARY KEY,
  source_kind text NOT NULL,
  thread_id text,
  occurred_at timestamptz NOT NULL,
  priority text NOT NULL,
  priority_rank smallint NOT NULL,
  requires_immediate_tick boolean NOT NULL DEFAULT false,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  claim_tick_id text REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stimulus_inbox_source_kind_check CHECK (
    source_kind IN ('http', 'file', 'telegram', 'scheduler', 'resource', 'system')
  ),
  CONSTRAINT stimulus_inbox_priority_check CHECK (
    priority IN ('low', 'normal', 'high', 'critical')
  ),
  CONSTRAINT stimulus_inbox_priority_rank_check CHECK (priority_rank BETWEEN 0 AND 3),
  CONSTRAINT stimulus_inbox_status_check CHECK (
    status IN ('queued', 'claimed', 'consumed', 'dropped')
  )
);

CREATE INDEX IF NOT EXISTS stimulus_inbox_ready_idx
  ON polyphony_runtime.stimulus_inbox (
    status,
    requires_immediate_tick DESC,
    priority_rank DESC,
    occurred_at ASC,
    stimulus_id ASC
  );

CREATE INDEX IF NOT EXISTS stimulus_inbox_dedupe_idx
  ON polyphony_runtime.stimulus_inbox (source_kind, dedupe_key, occurred_at DESC)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS stimulus_inbox_claim_idx
  ON polyphony_runtime.stimulus_inbox (claim_tick_id, status, updated_at DESC);
