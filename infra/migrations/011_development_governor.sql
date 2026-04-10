CREATE TABLE IF NOT EXISTS polyphony_runtime.development_freezes (
  freeze_id text PRIMARY KEY,
  state text NOT NULL,
  trigger_kind text NOT NULL,
  origin_surface text NOT NULL,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  reason text NOT NULL,
  requested_by text NOT NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_freezes_state_check CHECK (state IN ('frozen')),
  CONSTRAINT development_freezes_trigger_kind_check CHECK (
    trigger_kind IN ('operator', 'policy_auto')
  ),
  CONSTRAINT development_freezes_origin_surface_check CHECK (
    origin_surface IN (
      'operator_api',
      'homeostat',
      'runtime',
      'recovery',
      'workshop',
      'human_override'
    )
  ),
  CONSTRAINT development_freezes_evidence_refs_json_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS development_freezes_created_at_idx
  ON polyphony_runtime.development_freezes (created_at DESC, freeze_id DESC);

CREATE INDEX IF NOT EXISTS development_freezes_state_idx
  ON polyphony_runtime.development_freezes (state, created_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.development_proposals (
  proposal_id text PRIMARY KEY,
  proposal_kind text NOT NULL,
  state text NOT NULL,
  origin_surface text NOT NULL,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_proposals_kind_check CHECK (
    proposal_kind IN ('model_adapter', 'specialist_model', 'code_change', 'policy_change')
  ),
  CONSTRAINT development_proposals_state_check CHECK (
    state IN (
      'submitted',
      'approved',
      'rejected',
      'deferred',
      'superseded',
      'executed',
      'rolled_back'
    )
  ),
  CONSTRAINT development_proposals_origin_surface_check CHECK (
    origin_surface IN (
      'operator_api',
      'homeostat',
      'runtime',
      'recovery',
      'workshop',
      'human_override'
    )
  ),
  CONSTRAINT development_proposals_payload_json_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  ),
  CONSTRAINT development_proposals_evidence_refs_json_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS development_proposals_created_at_idx
  ON polyphony_runtime.development_proposals (created_at DESC, proposal_id DESC);

CREATE INDEX IF NOT EXISTS development_proposals_state_idx
  ON polyphony_runtime.development_proposals (state, created_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.development_proposal_decisions (
  decision_id text PRIMARY KEY,
  proposal_id text NOT NULL REFERENCES polyphony_runtime.development_proposals (proposal_id),
  decision_kind text NOT NULL,
  origin_surface text NOT NULL,
  request_id text NOT NULL UNIQUE,
  rationale text NOT NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_proposal_decisions_kind_check CHECK (
    decision_kind IN ('approved', 'rejected', 'deferred')
  ),
  CONSTRAINT development_proposal_decisions_origin_surface_check CHECK (
    origin_surface IN (
      'operator_api',
      'homeostat',
      'runtime',
      'recovery',
      'workshop',
      'human_override'
    )
  ),
  CONSTRAINT development_proposal_decisions_evidence_refs_json_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS development_proposal_decisions_proposal_idx
  ON polyphony_runtime.development_proposal_decisions (proposal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS polyphony_runtime.development_ledger (
  ledger_id text PRIMARY KEY,
  entry_kind text NOT NULL,
  origin_surface text NOT NULL,
  request_id text NOT NULL,
  freeze_id text REFERENCES polyphony_runtime.development_freezes (freeze_id),
  proposal_id text REFERENCES polyphony_runtime.development_proposals (proposal_id),
  decision_id text REFERENCES polyphony_runtime.development_proposal_decisions (decision_id),
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_ledger_entry_kind_check CHECK (
    entry_kind IN ('freeze_created', 'proposal_recorded', 'proposal_decision_recorded')
  ),
  CONSTRAINT development_ledger_origin_surface_check CHECK (
    origin_surface IN (
      'operator_api',
      'homeostat',
      'runtime',
      'recovery',
      'workshop',
      'human_override'
    )
  ),
  CONSTRAINT development_ledger_payload_json_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  ),
  CONSTRAINT development_ledger_evidence_refs_json_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS development_ledger_created_at_idx
  ON polyphony_runtime.development_ledger (created_at DESC, ledger_id DESC);

CREATE INDEX IF NOT EXISTS development_ledger_request_idx
  ON polyphony_runtime.development_ledger (request_id, created_at DESC);
