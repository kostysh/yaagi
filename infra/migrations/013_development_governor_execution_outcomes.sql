CREATE TABLE IF NOT EXISTS polyphony_runtime.development_proposal_execution_outcomes (
  outcome_id text PRIMARY KEY,
  proposal_id text NOT NULL REFERENCES polyphony_runtime.development_proposals (proposal_id),
  outcome_kind text NOT NULL,
  outcome_origin text NOT NULL,
  origin_surface text NOT NULL,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  target_ref text NOT NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_proposal_execution_outcomes_kind_check CHECK (
    outcome_kind IN ('executed', 'rolled_back')
  ),
  CONSTRAINT development_proposal_execution_outcomes_origin_check CHECK (
    outcome_origin IN (
      'operator_api',
      'homeostat',
      'runtime',
      'recovery',
      'workshop',
      'human_override'
    )
  ),
  CONSTRAINT development_proposal_execution_outcomes_surface_check CHECK (
    origin_surface IN (
      'operator_api',
      'homeostat',
      'runtime',
      'recovery',
      'workshop',
      'human_override'
    )
  ),
  CONSTRAINT development_proposal_execution_outcomes_payload_json_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  ),
  CONSTRAINT development_proposal_execution_outcomes_evidence_refs_json_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS development_proposal_execution_outcomes_proposal_idx
  ON polyphony_runtime.development_proposal_execution_outcomes (proposal_id, created_at DESC);

DO $$
BEGIN
  ALTER TABLE polyphony_runtime.development_ledger
    DROP CONSTRAINT development_ledger_entry_kind_check;

  ALTER TABLE polyphony_runtime.development_ledger
    ADD CONSTRAINT development_ledger_entry_kind_check CHECK (
      entry_kind IN (
        'freeze_created',
        'proposal_recorded',
        'proposal_decision_recorded',
        'proposal_execution_recorded'
      )
    );
EXCEPTION
  WHEN undefined_object THEN
    ALTER TABLE polyphony_runtime.development_ledger
      ADD CONSTRAINT development_ledger_entry_kind_check CHECK (
        entry_kind IN (
          'freeze_created',
          'proposal_recorded',
          'proposal_decision_recorded',
          'proposal_execution_recorded'
        )
      );
END $$;
