DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rollback_executions_plan_deploy_unique'
      AND conrelid = 'polyphony_runtime.rollback_executions'::regclass
  ) THEN
    ALTER TABLE polyphony_runtime.rollback_executions
      ADD CONSTRAINT rollback_executions_plan_deploy_unique UNIQUE (
        rollback_plan_id,
        deploy_attempt_id
      );
  END IF;
END $$;
