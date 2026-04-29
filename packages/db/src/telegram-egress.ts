import type { Client, QueryResultRow } from 'pg';

export type TelegramEgressDbExecutor = Pick<Client, 'query'>;

export const TELEGRAM_EGRESS_STATUS = Object.freeze({
  PENDING: 'pending',
  SENDING: 'sending',
  SENT: 'sent',
  RETRY_SCHEDULED: 'retry_scheduled',
  FAILED: 'failed',
  REFUSED: 'refused',
} as const);

export type TelegramEgressStatus =
  (typeof TELEGRAM_EGRESS_STATUS)[keyof typeof TELEGRAM_EGRESS_STATUS];

export type TelegramEgressMessageRow = {
  egressMessageId: string;
  actionId: string;
  tickId: string;
  replyToStimulusId: string;
  replyToTelegramUpdateId: number | null;
  recipientKind: 'operator_direct_chat';
  recipientChatIdHash: string;
  textJson: Record<string, unknown>;
  idempotencyKey: string;
  status: TelegramEgressStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  telegramMessageId: number | null;
  lastErrorCode: string | null;
  lastErrorJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

export type TelegramStimulusContext = {
  stimulusId: string;
  sourceKind: string;
  threadId: string | null;
  payloadJson: Record<string, unknown>;
  normalizedJson: Record<string, unknown>;
};

export type RecordTelegramEgressIntentInput = {
  actionId: string;
  tickId: string;
  replyToStimulusId: string;
  replyToTelegramUpdateId?: number | null;
  recipientChatIdHash: string;
  text: string;
};

export type RecordTelegramEgressRefusalInput = {
  actionId: string;
  tickId: string;
  replyToStimulusId?: string | null;
  replyToTelegramUpdateId?: number | null;
  recipientChatIdHash?: string | null;
  text?: string | null;
  reason: string;
};

export type MarkTelegramEgressFailureInput = {
  actionId: string;
  reason: string;
  errorJson?: Record<string, unknown>;
};

export type TelegramEgressStore = {
  getStimulusContext(stimulusId: string): Promise<TelegramStimulusContext | null>;
  getByActionId(actionId: string): Promise<TelegramEgressMessageRow | null>;
  recordIntent(input: RecordTelegramEgressIntentInput): Promise<TelegramEgressMessageRow>;
  recordRefusal(input: RecordTelegramEgressRefusalInput): Promise<TelegramEgressMessageRow>;
  markSending(actionId: string): Promise<TelegramEgressMessageRow | null>;
  markSent(input: {
    actionId: string;
    telegramMessageId: number;
  }): Promise<TelegramEgressMessageRow>;
  markRetryScheduled(input: MarkTelegramEgressFailureInput): Promise<TelegramEgressMessageRow>;
  markFailed(input: MarkTelegramEgressFailureInput): Promise<TelegramEgressMessageRow>;
  listReadyToRetry(input?: { limit?: number }): Promise<TelegramEgressMessageRow[]>;
};

const tableName = 'polyphony_runtime.telegram_egress_messages';
const stimulusTableName = 'polyphony_runtime.stimulus_inbox';
const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const rowColumns = `
  egress_message_id as "egressMessageId",
  action_id as "actionId",
  tick_id as "tickId",
  reply_to_stimulus_id as "replyToStimulusId",
  reply_to_telegram_update_id as "replyToTelegramUpdateId",
  recipient_kind as "recipientKind",
  recipient_chat_id_hash as "recipientChatIdHash",
  text_json as "textJson",
  idempotency_key as "idempotencyKey",
  status,
  attempt_count as "attemptCount",
  ${asUtcIso('next_attempt_at', 'nextAttemptAt')},
  telegram_message_id as "telegramMessageId",
  last_error_code as "lastErrorCode",
  last_error_json as "lastErrorJson",
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')},
  ${asUtcIso('sent_at', 'sentAt')}
`;

const scalarLength = (value: string): number => [...value].length;

const parseJsonObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  return {};
};

const normalizeNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) return Number(value);
  return null;
};

const normalizeRow = (row: QueryResultRow): TelegramEgressMessageRow => ({
  egressMessageId: String(row['egressMessageId']),
  actionId: String(row['actionId']),
  tickId: String(row['tickId']),
  replyToStimulusId: String(row['replyToStimulusId']),
  replyToTelegramUpdateId: normalizeNullableNumber(row['replyToTelegramUpdateId']),
  recipientKind: 'operator_direct_chat',
  recipientChatIdHash: String(row['recipientChatIdHash']),
  textJson: parseJsonObject(row['textJson']),
  idempotencyKey: String(row['idempotencyKey']),
  status: row['status'] as TelegramEgressStatus,
  attemptCount: Number(row['attemptCount'] ?? 0),
  nextAttemptAt: typeof row['nextAttemptAt'] === 'string' ? row['nextAttemptAt'] : null,
  telegramMessageId: normalizeNullableNumber(row['telegramMessageId']),
  lastErrorCode: typeof row['lastErrorCode'] === 'string' ? row['lastErrorCode'] : null,
  lastErrorJson: parseJsonObject(row['lastErrorJson']),
  createdAt: String(row['createdAt']),
  updatedAt: String(row['updatedAt']),
  sentAt: typeof row['sentAt'] === 'string' ? row['sentAt'] : null,
});

const normalizeStimulusContext = (row: QueryResultRow): TelegramStimulusContext => ({
  stimulusId: String(row['stimulusId']),
  sourceKind: String(row['sourceKind']),
  threadId: typeof row['threadId'] === 'string' ? row['threadId'] : null,
  payloadJson: parseJsonObject(row['payloadJson']),
  normalizedJson: parseJsonObject(row['normalizedJson']),
});

const makeEgressMessageId = (actionId: string): string => `telegram-egress:${actionId}`;
const makeIdempotencyKey = (actionId: string): string => `telegram.sendMessage:${actionId}`;

export function createTelegramEgressStore(db: TelegramEgressDbExecutor): TelegramEgressStore {
  const getRequiredRow = async (actionId: string): Promise<TelegramEgressMessageRow> => {
    const row = await store.getByActionId(actionId);
    if (!row) {
      throw new Error(`missing telegram egress row for action ${actionId}`);
    }
    return row;
  };

  const store: TelegramEgressStore = {
    async getStimulusContext(stimulusId): Promise<TelegramStimulusContext | null> {
      const result = await db.query<QueryResultRow>(
        `select
           stimulus_id as "stimulusId",
           source_kind as "sourceKind",
           thread_id as "threadId",
           payload_json as "payloadJson",
           normalized_json as "normalizedJson"
         from ${stimulusTableName}
         where stimulus_id = $1
         limit 1`,
        [stimulusId],
      );

      return result.rows[0] ? normalizeStimulusContext(result.rows[0]) : null;
    },

    async getByActionId(actionId): Promise<TelegramEgressMessageRow | null> {
      const result = await db.query<TelegramEgressMessageRow>(
        `select ${rowColumns}
         from ${tableName}
         where action_id = $1
         limit 1`,
        [actionId],
      );

      return result.rows[0] ? normalizeRow(result.rows[0]) : null;
    },

    async recordIntent(input): Promise<TelegramEgressMessageRow> {
      const textJson = {
        text: input.text,
        scalarLength: scalarLength(input.text),
      };
      const result = await db.query<TelegramEgressMessageRow>(
        `insert into ${tableName} (
           egress_message_id,
           action_id,
           tick_id,
           reply_to_stimulus_id,
           reply_to_telegram_update_id,
           recipient_kind,
           recipient_chat_id_hash,
           text_json,
           idempotency_key,
           status,
           attempt_count,
           last_error_json,
           created_at,
           updated_at
         ) values (
           $1, $2, $3, $4, $5, 'operator_direct_chat', $6, $7::jsonb, $8, $9, 0, '{}'::jsonb, now(), now()
         )
         on conflict (action_id) do nothing
         returning ${rowColumns}`,
        [
          makeEgressMessageId(input.actionId),
          input.actionId,
          input.tickId,
          input.replyToStimulusId,
          input.replyToTelegramUpdateId ?? null,
          input.recipientChatIdHash,
          JSON.stringify(textJson),
          makeIdempotencyKey(input.actionId),
          TELEGRAM_EGRESS_STATUS.PENDING,
        ],
      );

      return result.rows[0] ? normalizeRow(result.rows[0]) : getRequiredRow(input.actionId);
    },

    async recordRefusal(input): Promise<TelegramEgressMessageRow> {
      const text = input.text ?? '';
      const textJson = {
        text,
        scalarLength: scalarLength(text),
        refusalReason: input.reason,
      };
      const result = await db.query<TelegramEgressMessageRow>(
        `insert into ${tableName} (
           egress_message_id,
           action_id,
           tick_id,
           reply_to_stimulus_id,
           reply_to_telegram_update_id,
           recipient_kind,
           recipient_chat_id_hash,
           text_json,
           idempotency_key,
           status,
           attempt_count,
           last_error_code,
           last_error_json,
           created_at,
           updated_at
         ) values (
           $1, $2, $3, $4, $5, 'operator_direct_chat', $6, $7::jsonb, $8, $9, 0, $10, $11::jsonb, now(), now()
         )
         on conflict (action_id) do nothing
         returning ${rowColumns}`,
        [
          makeEgressMessageId(input.actionId),
          input.actionId,
          input.tickId,
          input.replyToStimulusId ?? 'unavailable',
          input.replyToTelegramUpdateId ?? null,
          input.recipientChatIdHash ?? 'unavailable',
          JSON.stringify(textJson),
          makeIdempotencyKey(input.actionId),
          TELEGRAM_EGRESS_STATUS.REFUSED,
          input.reason,
          JSON.stringify({ reason: input.reason }),
        ],
      );

      return result.rows[0] ? normalizeRow(result.rows[0]) : getRequiredRow(input.actionId);
    },

    async markSending(actionId): Promise<TelegramEgressMessageRow | null> {
      const result = await db.query<TelegramEgressMessageRow>(
        `update ${tableName}
         set status = $2,
             attempt_count = attempt_count + 1,
             next_attempt_at = null,
             updated_at = now()
         where action_id = $1
           and attempt_count < 3
           and (
             status = $3
             or (status = $4 and (next_attempt_at is null or next_attempt_at <= now()))
           )
         returning ${rowColumns}`,
        [
          actionId,
          TELEGRAM_EGRESS_STATUS.SENDING,
          TELEGRAM_EGRESS_STATUS.PENDING,
          TELEGRAM_EGRESS_STATUS.RETRY_SCHEDULED,
        ],
      );

      return result.rows[0] ? normalizeRow(result.rows[0]) : null;
    },

    async markSent({ actionId, telegramMessageId }): Promise<TelegramEgressMessageRow> {
      const result = await db.query<TelegramEgressMessageRow>(
        `update ${tableName}
         set status = $2,
             telegram_message_id = $3,
             next_attempt_at = null,
             last_error_code = null,
             last_error_json = '{}'::jsonb,
             sent_at = now(),
             updated_at = now()
         where action_id = $1
         returning ${rowColumns}`,
        [actionId, TELEGRAM_EGRESS_STATUS.SENT, telegramMessageId],
      );

      return result.rows[0] ? normalizeRow(result.rows[0]) : getRequiredRow(actionId);
    },

    async markRetryScheduled(input): Promise<TelegramEgressMessageRow> {
      const result = await db.query<TelegramEgressMessageRow>(
        `update ${tableName}
         set status = $2,
             next_attempt_at = now(),
             last_error_code = $3,
             last_error_json = $4::jsonb,
             updated_at = now()
         where action_id = $1
         returning ${rowColumns}`,
        [
          input.actionId,
          TELEGRAM_EGRESS_STATUS.RETRY_SCHEDULED,
          input.reason,
          JSON.stringify(input.errorJson ?? {}),
        ],
      );

      return result.rows[0] ? normalizeRow(result.rows[0]) : getRequiredRow(input.actionId);
    },

    async markFailed(input): Promise<TelegramEgressMessageRow> {
      const result = await db.query<TelegramEgressMessageRow>(
        `update ${tableName}
         set status = $2,
             next_attempt_at = null,
             last_error_code = $3,
             last_error_json = $4::jsonb,
             updated_at = now()
         where action_id = $1
         returning ${rowColumns}`,
        [
          input.actionId,
          TELEGRAM_EGRESS_STATUS.FAILED,
          input.reason,
          JSON.stringify(input.errorJson ?? {}),
        ],
      );

      return result.rows[0] ? normalizeRow(result.rows[0]) : getRequiredRow(input.actionId);
    },

    async listReadyToRetry({ limit = 50 } = {}): Promise<TelegramEgressMessageRow[]> {
      const result = await db.query<TelegramEgressMessageRow>(
        `select ${rowColumns}
         from ${tableName}
         where status in ($1, $2)
           and (next_attempt_at is null or next_attempt_at <= now())
         order by created_at asc
         limit $3`,
        [TELEGRAM_EGRESS_STATUS.PENDING, TELEGRAM_EGRESS_STATUS.RETRY_SCHEDULED, limit],
      );

      return result.rows.map(normalizeRow);
    },
  };

  return store;
}
