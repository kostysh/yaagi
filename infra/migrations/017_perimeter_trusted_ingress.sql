ALTER TABLE polyphony_runtime.perimeter_decisions
  DROP CONSTRAINT IF EXISTS perimeter_decisions_authority_owner_check;

ALTER TABLE polyphony_runtime.perimeter_decisions
  DROP CONSTRAINT IF EXISTS perimeter_decisions_authority_shape_check;

ALTER TABLE polyphony_runtime.perimeter_decisions
  ADD CONSTRAINT perimeter_decisions_authority_owner_check CHECK (
    authority_owner IN ('governor', 'human_override', 'trusted_ingress')
  );

ALTER TABLE polyphony_runtime.perimeter_decisions
  ADD CONSTRAINT perimeter_decisions_authority_shape_check CHECK (
    (
      authority_owner = 'governor'
      AND governor_proposal_id IS NOT NULL
      AND governor_decision_ref IS NOT NULL
      AND human_override_evidence_ref IS NULL
    )
    OR (
      authority_owner = 'human_override'
      AND governor_proposal_id IS NULL
      AND governor_decision_ref IS NULL
      AND human_override_evidence_ref IS NOT NULL
    )
    OR (
      authority_owner = 'trusted_ingress'
      AND governor_proposal_id IS NULL
      AND governor_decision_ref IS NULL
      AND human_override_evidence_ref IS NULL
    )
  );
