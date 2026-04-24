ALTER TABLE polyphony_runtime.rollback_executions
  DROP CONSTRAINT IF EXISTS rollback_executions_status_check;

ALTER TABLE polyphony_runtime.rollback_executions
  ADD CONSTRAINT rollback_executions_status_check CHECK (
    status IN ('running', 'succeeded', 'failed', 'critical_failure')
  );
