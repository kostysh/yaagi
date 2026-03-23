ALTER TABLE polyphony_runtime.agent_state
  ADD COLUMN IF NOT EXISTS psm_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resource_posture_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS polyphony_runtime.goals (
  goal_id text PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  goal_type text NOT NULL,
  parent_goal_id text REFERENCES polyphony_runtime.goals (goal_id) ON DELETE SET NULL,
  rationale_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goals_status_check CHECK (
    status IN ('proposed', 'active', 'blocked', 'completed', 'abandoned')
  )
);

CREATE INDEX IF NOT EXISTS goals_active_priority_idx
  ON polyphony_runtime.goals (status, priority DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.beliefs (
  belief_id text PRIMARY KEY,
  topic text NOT NULL,
  proposition text NOT NULL,
  confidence numeric(5,4) NOT NULL,
  status text NOT NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beliefs_confidence_range_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT beliefs_status_check CHECK (
    status IN ('candidate', 'active', 'superseded', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS beliefs_snapshot_confidence_idx
  ON polyphony_runtime.beliefs (confidence DESC, updated_at DESC, belief_id ASC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.entities (
  entity_id text PRIMARY KEY,
  entity_kind text NOT NULL,
  canonical_name text NOT NULL,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  trust_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entities_name_idx
  ON polyphony_runtime.entities (canonical_name);

CREATE INDEX IF NOT EXISTS entities_last_seen_idx
  ON polyphony_runtime.entities (last_seen_at DESC NULLS LAST, updated_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.relationships (
  src_entity_id text NOT NULL REFERENCES polyphony_runtime.entities (entity_id) ON DELETE CASCADE,
  dst_entity_id text NOT NULL REFERENCES polyphony_runtime.entities (entity_id) ON DELETE CASCADE,
  relation_kind text NOT NULL,
  confidence numeric(5,4) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (src_entity_id, dst_entity_id, relation_kind),
  CONSTRAINT relationships_confidence_range_check CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS relationships_src_idx
  ON polyphony_runtime.relationships (src_entity_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS relationships_dst_idx
  ON polyphony_runtime.relationships (dst_entity_id, updated_at DESC);
