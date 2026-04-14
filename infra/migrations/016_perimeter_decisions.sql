CREATE TABLE IF NOT EXISTS polyphony_runtime.perimeter_decisions (
  decision_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  normalized_request_hash text NOT NULL,
  action_class text NOT NULL,
  ingress_owner text NOT NULL,
  authority_owner text NOT NULL,
  governor_proposal_id text,
  governor_decision_ref text,
  human_override_evidence_ref text,
  target_ref text,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  verdict text NOT NULL,
  decision_reason text NOT NULL,
  policy_version text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perimeter_decisions_action_class_check CHECK (
    action_class IN (
      'freeze_development',
      'force_rollback',
      'disable_external_network',
      'code_or_promotion_change'
    )
  ),
  CONSTRAINT perimeter_decisions_ingress_owner_check CHECK (
    ingress_owner IN ('F-0013', 'F-0016', 'F-0017', 'CF-025', 'platform-runtime')
  ),
  CONSTRAINT perimeter_decisions_authority_owner_check CHECK (
    authority_owner IN ('governor', 'human_override')
  ),
  CONSTRAINT perimeter_decisions_authority_shape_check CHECK (
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
  ),
  CONSTRAINT perimeter_decisions_evidence_refs_json_array_check CHECK (
    jsonb_typeof(evidence_refs_json) = 'array'
  ),
  CONSTRAINT perimeter_decisions_verdict_check CHECK (
    verdict IN ('allow', 'deny', 'require_human_review')
  ),
  CONSTRAINT perimeter_decisions_decision_reason_check CHECK (
    decision_reason IN (
      'verified_authority',
      'trusted_ingress_missing',
      'governor_authority_missing',
      'human_override_evidence_missing',
      'explicit_unavailable',
      'downstream_owner_required'
    )
  ),
  CONSTRAINT perimeter_decisions_payload_json_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS perimeter_decisions_created_at_idx
  ON polyphony_runtime.perimeter_decisions (created_at DESC, decision_id DESC);

CREATE INDEX IF NOT EXISTS perimeter_decisions_action_class_idx
  ON polyphony_runtime.perimeter_decisions (action_class, created_at DESC);
