CREATE SCHEMA IF NOT EXISTS platform_bootstrap;
CREATE SCHEMA IF NOT EXISTS pgboss;

CREATE TABLE IF NOT EXISTS platform_bootstrap.schema_state (
  id integer PRIMARY KEY DEFAULT 1,
  schema_version text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_bootstrap.schema_state (id, schema_version)
VALUES (1, '2026-03-19')
ON CONFLICT (id) DO UPDATE SET
  schema_version = EXCLUDED.schema_version,
  applied_at = now();
