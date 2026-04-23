CREATE TABLE IF NOT EXISTS polyphony_runtime.operator_auth_audit_events (
  audit_event_id text PRIMARY KEY,
  request_id text NOT NULL,
  principal_ref text NULL,
  session_ref text NULL,
  method text NOT NULL,
  route text NOT NULL,
  route_class text NOT NULL,
  risk_class text NOT NULL,
  decision text NOT NULL,
  denial_reason text NULL,
  evidence_ref text NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  CONSTRAINT operator_auth_audit_events_route_class_check CHECK (
    route_class IN (
      'public_health',
      'read_introspection',
      'tick_control',
      'governor_submission',
      'human_override',
      'admin_auth'
    )
  ),
  CONSTRAINT operator_auth_audit_events_risk_class_check CHECK (
    risk_class IN ('public', 'read_only', 'control', 'high_risk', 'admin')
  ),
  CONSTRAINT operator_auth_audit_events_decision_check CHECK (
    decision IN ('allow', 'deny', 'unavailable')
  ),
  CONSTRAINT operator_auth_audit_events_denial_reason_check CHECK (
    denial_reason IS NULL
    OR denial_reason IN (
      'unauthenticated',
      'expired',
      'revoked',
      'forbidden',
      'rate_limited',
      'unsupported_route',
      'unsupported_token_version',
      'auth_config_missing',
      'auth_config_invalid',
      'auth_store_unavailable',
      'downstream_owner_unavailable'
    )
  ),
  CONSTRAINT operator_auth_audit_events_payload_object_check CHECK (
    jsonb_typeof(payload_json) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS operator_auth_audit_events_request_idx
  ON polyphony_runtime.operator_auth_audit_events (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS operator_auth_audit_events_principal_idx
  ON polyphony_runtime.operator_auth_audit_events (principal_ref, created_at DESC)
  WHERE principal_ref IS NOT NULL;
