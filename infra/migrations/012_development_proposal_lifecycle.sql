ALTER TABLE polyphony_runtime.development_proposals
  ADD COLUMN IF NOT EXISTS submitter_owner text NOT NULL DEFAULT 'operator_api',
  ADD COLUMN IF NOT EXISTS problem_signature text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rollback_plan_ref text,
  ADD COLUMN IF NOT EXISTS target_ref text;

UPDATE polyphony_runtime.development_proposals
SET problem_signature = title
WHERE problem_signature = '';

ALTER TABLE polyphony_runtime.development_proposal_decisions
  ADD COLUMN IF NOT EXISTS normalized_request_hash text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS decision_origin text NOT NULL DEFAULT 'human_override';

DO $$
BEGIN
  ALTER TABLE polyphony_runtime.development_proposal_decisions
    ADD CONSTRAINT development_proposal_decisions_origin_check CHECK (
      decision_origin IN (
        'operator_api',
        'homeostat',
        'runtime',
        'recovery',
        'workshop',
        'human_override'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
