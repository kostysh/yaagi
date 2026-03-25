CREATE TABLE IF NOT EXISTS polyphony_runtime.memetic_units (
  unit_id text PRIMARY KEY,
  origin_kind text NOT NULL,
  unit_type text NOT NULL,
  abstract_label text NOT NULL,
  canonical_summary text NOT NULL,
  activation_score numeric(5,4) NOT NULL DEFAULT 0,
  reinforcement_score numeric(5,4) NOT NULL DEFAULT 0,
  decay_score numeric(5,4) NOT NULL DEFAULT 0,
  evidence_score numeric(5,4) NOT NULL DEFAULT 0,
  status text NOT NULL,
  last_activated_tick_id text REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE SET NULL,
  created_by_path text NOT NULL,
  provenance_anchors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memetic_units_origin_kind_check CHECK (
    origin_kind IN ('seeded', 'consolidated', 'governor_labeled')
  ),
  CONSTRAINT memetic_units_score_range_check CHECK (
    activation_score >= 0
    AND activation_score <= 1
    AND reinforcement_score >= 0
    AND reinforcement_score <= 1
    AND decay_score >= 0
    AND decay_score <= 1
    AND evidence_score >= 0
    AND evidence_score <= 1
  ),
  CONSTRAINT memetic_units_status_check CHECK (
    status IN ('active', 'dormant', 'quarantined', 'retired', 'merged')
  )
);

CREATE INDEX IF NOT EXISTS memetic_units_status_activation_idx
  ON polyphony_runtime.memetic_units (status, activation_score DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS memetic_units_last_activated_idx
  ON polyphony_runtime.memetic_units (last_activated_tick_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.memetic_edges (
  edge_id text PRIMARY KEY,
  source_unit_id text NOT NULL REFERENCES polyphony_runtime.memetic_units (unit_id) ON DELETE CASCADE,
  target_unit_id text NOT NULL REFERENCES polyphony_runtime.memetic_units (unit_id) ON DELETE CASCADE,
  relation_kind text NOT NULL,
  strength numeric(5,4) NOT NULL,
  confidence numeric(5,4) NOT NULL,
  tick_id text NOT NULL REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memetic_edges_relation_kind_check CHECK (
    relation_kind IN ('supports', 'suppresses', 'contextualizes', 'contradicts')
  ),
  CONSTRAINT memetic_edges_score_range_check CHECK (
    strength >= 0
    AND strength <= 1
    AND confidence >= 0
    AND confidence <= 1
  ),
  CONSTRAINT memetic_edges_unique_relation UNIQUE (source_unit_id, target_unit_id, relation_kind)
);

CREATE INDEX IF NOT EXISTS memetic_edges_source_target_idx
  ON polyphony_runtime.memetic_edges (source_unit_id, target_unit_id, relation_kind);

CREATE INDEX IF NOT EXISTS memetic_edges_tick_idx
  ON polyphony_runtime.memetic_edges (tick_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.coalitions (
  coalition_id text PRIMARY KEY,
  tick_id text NOT NULL UNIQUE REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE CASCADE,
  decision_mode text NOT NULL,
  vector text NOT NULL,
  member_unit_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  support_score numeric(5,4) NOT NULL,
  suppression_score numeric(5,4) NOT NULL,
  winning boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coalitions_decision_mode_check CHECK (
    decision_mode IN ('reactive', 'deliberative', 'contemplative')
  ),
  CONSTRAINT coalitions_score_range_check CHECK (
    support_score >= 0
    AND support_score <= 1
    AND suppression_score >= 0
    AND suppression_score <= 1
  )
);

CREATE INDEX IF NOT EXISTS coalitions_tick_winning_idx
  ON polyphony_runtime.coalitions (tick_id, winning);

CREATE INDEX IF NOT EXISTS coalitions_created_at_idx
  ON polyphony_runtime.coalitions (created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ticks_selected_coalition_fk'
  ) THEN
    ALTER TABLE polyphony_runtime.ticks
      ADD CONSTRAINT ticks_selected_coalition_fk
      FOREIGN KEY (selected_coalition_id)
      REFERENCES polyphony_runtime.coalitions (coalition_id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS polyphony_runtime.narrative_spine_versions (
  version_id text PRIMARY KEY,
  tick_id text NOT NULL UNIQUE REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE CASCADE,
  based_on_version_id text REFERENCES polyphony_runtime.narrative_spine_versions (version_id) ON DELETE SET NULL,
  current_chapter text NOT NULL,
  summary text NOT NULL,
  continuity_direction text NOT NULL,
  tensions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance_anchors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS narrative_spine_versions_tick_idx
  ON polyphony_runtime.narrative_spine_versions (tick_id, created_at DESC);

CREATE INDEX IF NOT EXISTS narrative_spine_versions_created_at_idx
  ON polyphony_runtime.narrative_spine_versions (created_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.field_journal_entries (
  entry_id text PRIMARY KEY,
  tick_id text NOT NULL REFERENCES polyphony_runtime.ticks (tick_id) ON DELETE CASCADE,
  entry_type text NOT NULL,
  summary text NOT NULL,
  interpretation text NOT NULL,
  tension_markers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  maturity_state text NOT NULL,
  linked_unit_id text REFERENCES polyphony_runtime.memetic_units (unit_id) ON DELETE SET NULL,
  provenance_anchors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_journal_entries_maturity_state_check CHECK (
    maturity_state IN ('immature', 'tracking', 'escalated')
  )
);

CREATE INDEX IF NOT EXISTS field_journal_entries_maturity_idx
  ON polyphony_runtime.field_journal_entries (maturity_state, created_at DESC);

CREATE INDEX IF NOT EXISTS field_journal_entries_tick_idx
  ON polyphony_runtime.field_journal_entries (tick_id, created_at DESC);
