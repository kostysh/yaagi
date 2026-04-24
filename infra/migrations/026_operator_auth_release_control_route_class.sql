ALTER TABLE polyphony_runtime.operator_auth_audit_events
  DROP CONSTRAINT IF EXISTS operator_auth_audit_events_route_class_check;

ALTER TABLE polyphony_runtime.operator_auth_audit_events
  ADD CONSTRAINT operator_auth_audit_events_route_class_check CHECK (
    route_class IN (
      'public_health',
      'read_introspection',
      'tick_control',
      'governor_submission',
      'release_control',
      'human_override',
      'admin_auth'
    )
  );
