ALTER TABLE polyphony_runtime.release_requests
  ADD COLUMN IF NOT EXISTS rollback_target_ref text;

UPDATE polyphony_runtime.release_requests rr
SET rollback_target_ref = rp.rollback_target_ref
FROM polyphony_runtime.rollback_plans rp
WHERE rr.request_id = rp.release_request_id
  AND rr.rollback_target_ref IS NULL;

UPDATE polyphony_runtime.release_requests
SET rollback_target_ref = 'rollback-target:legacy-missing'
WHERE rollback_target_ref IS NULL;

ALTER TABLE polyphony_runtime.release_requests
  ALTER COLUMN rollback_target_ref SET NOT NULL;
