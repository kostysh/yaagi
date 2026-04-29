CREATE TABLE IF NOT EXISTS polyphony_runtime.telegram_egress_messages (
  egress_message_id text PRIMARY KEY,
  action_id text NOT NULL UNIQUE,
  tick_id text NOT NULL,
  reply_to_stimulus_id text NOT NULL,
  reply_to_telegram_update_id bigint NULL,
  recipient_kind text NOT NULL,
  recipient_chat_id_hash text NOT NULL,
  text_json jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NULL,
  telegram_message_id bigint NULL,
  last_error_code text NULL,
  last_error_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  CONSTRAINT telegram_egress_messages_recipient_kind_check CHECK (
    recipient_kind = 'operator_direct_chat'
  ),
  CONSTRAINT telegram_egress_messages_status_check CHECK (
    status IN ('pending', 'sending', 'sent', 'retry_scheduled', 'failed', 'refused')
  ),
  CONSTRAINT telegram_egress_messages_attempt_count_check CHECK (
    attempt_count >= 0 AND attempt_count <= 3
  ),
  CONSTRAINT telegram_egress_messages_text_json_object_check CHECK (
    jsonb_typeof(text_json) = 'object'
  ),
  CONSTRAINT telegram_egress_messages_error_json_object_check CHECK (
    jsonb_typeof(last_error_json) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS telegram_egress_messages_retry_idx
  ON polyphony_runtime.telegram_egress_messages (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS telegram_egress_messages_stimulus_idx
  ON polyphony_runtime.telegram_egress_messages (reply_to_stimulus_id, created_at DESC);

CREATE INDEX IF NOT EXISTS telegram_egress_messages_tick_idx
  ON polyphony_runtime.telegram_egress_messages (tick_id, created_at DESC);
