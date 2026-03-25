CREATE TABLE IF NOT EXISTS polyphony_runtime.homeostat_snapshots (
  snapshot_id text PRIMARY KEY,
  cadence_kind text NOT NULL,
  tick_id text REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE SET NULL,
  overall_stability numeric(5,4) NOT NULL,
  affect_volatility numeric(10,4),
  goal_churn numeric(10,4),
  coalition_dominance numeric(10,4),
  narrative_rewrite_rate numeric(10,4),
  development_proposal_rate numeric(10,4),
  resource_pressure numeric(10,4),
  organ_error_rate numeric(10,4),
  rollback_frequency numeric(10,4),
  development_freeze boolean NOT NULL DEFAULT false,
  signal_status_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  alerts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  reaction_request_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homeostat_snapshots_cadence_kind_check CHECK (
    cadence_kind IN ('tick_complete', 'periodic')
  ),
  CONSTRAINT homeostat_snapshots_overall_stability_range_check CHECK (
    overall_stability >= 0
    AND overall_stability <= 1
  )
);

CREATE INDEX IF NOT EXISTS homeostat_snapshots_created_at_idx
  ON polyphony_runtime.homeostat_snapshots (created_at DESC, snapshot_id DESC);

CREATE INDEX IF NOT EXISTS homeostat_snapshots_cadence_idx
  ON polyphony_runtime.homeostat_snapshots (cadence_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS homeostat_snapshots_tick_idx
  ON polyphony_runtime.homeostat_snapshots (tick_id, created_at DESC);
