import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TELEGRAM_EGRESS_STATUS,
  createTelegramEgressStore,
  type TelegramEgressDbExecutor,
  type TelegramEgressMessageRow,
} from '../src/index.ts';

type HarnessState = {
  rows: TelegramEgressMessageRow[];
  stimuli: Array<{
    stimulusId: string;
    sourceKind: string;
    threadId: string | null;
    payloadJson: Record<string, unknown>;
    normalizedJson: Record<string, unknown>;
  }>;
};

const now = '2026-04-29T12:00:00.000Z';
const createHarness = (): { db: TelegramEgressDbExecutor; state: HarnessState } => {
  const state: HarnessState = {
    rows: [],
    stimuli: [
      {
        stimulusId: 'stimulus-telegram-1',
        sourceKind: 'telegram',
        threadId: '12345',
        payloadJson: { chatId: '12345', chatType: 'private', updateId: 7 },
        normalizedJson: { envelope: { source: 'telegram' } },
      },
    ],
  };

  const db = {
    query: (sqlText: { text: string } | string, params: unknown[] = []) => {
      const sql = typeof sqlText === 'string' ? sqlText : sqlText.text;

      if (sql.includes('from polyphony_runtime.stimulus_inbox')) {
        return Promise.resolve({
          rows: state.stimuli.filter((row) => row.stimulusId === params[0]),
        });
      }

      if (
        sql.startsWith('select') &&
        sql.includes('from polyphony_runtime.telegram_egress_messages')
      ) {
        const rows = state.rows.filter((row) =>
          sql.includes('where action_id = $1')
            ? row.actionId === params[0]
            : row.status === TELEGRAM_EGRESS_STATUS.PENDING ||
              row.status === TELEGRAM_EGRESS_STATUS.RETRY_SCHEDULED,
        );
        return Promise.resolve({ rows });
      }

      if (sql.startsWith('insert into polyphony_runtime.telegram_egress_messages')) {
        const actionId = String(params[1]);
        const existing = state.rows.find((row) => row.actionId === actionId);
        if (existing) return Promise.resolve({ rows: [] });

        const row: TelegramEgressMessageRow = {
          egressMessageId: String(params[0]),
          actionId,
          tickId: String(params[2]),
          replyToStimulusId: String(params[3]),
          replyToTelegramUpdateId: typeof params[4] === 'number' ? params[4] : null,
          recipientKind: 'operator_direct_chat',
          recipientChatIdHash: String(params[5]),
          textJson: JSON.parse(String(params[6])) as Record<string, unknown>,
          idempotencyKey: String(params[7]),
          status: params[8] as TelegramEgressMessageRow['status'],
          attemptCount: 0,
          nextAttemptAt: null,
          telegramMessageId: null,
          lastErrorCode: typeof params[9] === 'string' ? params[9] : null,
          lastErrorJson:
            typeof params[10] === 'string'
              ? (JSON.parse(params[10]) as Record<string, unknown>)
              : {},
          createdAt: now,
          updatedAt: now,
          sentAt: null,
        };
        state.rows.push(row);
        return Promise.resolve({ rows: [row] });
      }

      if (sql.startsWith('update polyphony_runtime.telegram_egress_messages')) {
        const row = state.rows.find((entry) => entry.actionId === params[0]);
        if (!row) return Promise.resolve({ rows: [] });

        if (sql.includes('attempt_count = attempt_count + 1')) {
          const canClaim =
            row.status === TELEGRAM_EGRESS_STATUS.PENDING ||
            row.status === TELEGRAM_EGRESS_STATUS.RETRY_SCHEDULED;
          if (row.attemptCount < 3 && canClaim) {
            row.status = TELEGRAM_EGRESS_STATUS.SENDING;
            row.attemptCount += 1;
            row.nextAttemptAt = null;
          } else {
            return Promise.resolve({ rows: [] });
          }
        } else if (sql.includes('telegram_message_id = $3')) {
          row.status = TELEGRAM_EGRESS_STATUS.SENT;
          row.telegramMessageId = Number(params[2]);
          row.lastErrorCode = null;
          row.lastErrorJson = {};
          row.sentAt = now;
        } else if (params[1] === TELEGRAM_EGRESS_STATUS.RETRY_SCHEDULED) {
          row.status = TELEGRAM_EGRESS_STATUS.RETRY_SCHEDULED;
          row.nextAttemptAt = now;
          row.lastErrorCode = String(params[2]);
          row.lastErrorJson = JSON.parse(String(params[3])) as Record<string, unknown>;
        } else if (params[1] === TELEGRAM_EGRESS_STATUS.FAILED) {
          row.status = TELEGRAM_EGRESS_STATUS.FAILED;
          row.nextAttemptAt = null;
          row.lastErrorCode = String(params[2]);
          row.lastErrorJson = JSON.parse(String(params[3])) as Record<string, unknown>;
        }
        row.updatedAt = now;
        return Promise.resolve({ rows: [row] });
      }

      throw new Error(`unsupported sql in telegram egress harness: ${sql}`);
    },
  };

  return { db: db as never, state };
};

void test('AC-F0029-11 AC-F0029-12 AC-F0029-13 records one action-id keyed telegram egress intent', async () => {
  const harness = createHarness();
  const store = createTelegramEgressStore(harness.db);

  const stimulus = await store.getStimulusContext('stimulus-telegram-1');
  const first = await store.recordIntent({
    actionId: 'action-telegram-1',
    tickId: 'tick-1',
    replyToStimulusId: 'stimulus-telegram-1',
    replyToTelegramUpdateId: 7,
    recipientChatIdHash: 'sha256:operator',
    text: 'hello',
  });
  const replay = await store.recordIntent({
    actionId: 'action-telegram-1',
    tickId: 'tick-1',
    replyToStimulusId: 'stimulus-telegram-1',
    recipientChatIdHash: 'sha256:operator',
    text: 'hello again',
  });
  await store.markSent({ actionId: 'action-telegram-1', telegramMessageId: 100 });

  assert.equal(stimulus?.payloadJson['chatId'], '12345');
  assert.equal(harness.state.rows.length, 1);
  assert.equal(first.egressMessageId, 'telegram-egress:action-telegram-1');
  assert.equal(first.idempotencyKey, 'telegram.sendMessage:action-telegram-1');
  assert.equal(replay.textJson['text'], 'hello');
  assert.equal(harness.state.rows[0]?.status, TELEGRAM_EGRESS_STATUS.SENT);
  assert.equal(harness.state.rows[0]?.telegramMessageId, 100);
});

void test('AC-F0029-14 AC-F0029-15 AC-F0029-16 bounds retry state and terminal failure evidence', async () => {
  const harness = createHarness();
  const store = createTelegramEgressStore(harness.db);

  await store.recordIntent({
    actionId: 'action-retry',
    tickId: 'tick-retry',
    replyToStimulusId: 'stimulus-telegram-1',
    recipientChatIdHash: 'sha256:operator',
    text: 'retry',
  });
  await store.markSending('action-retry');
  await store.markRetryScheduled({
    actionId: 'action-retry',
    reason: 'telegram_api_error',
    errorJson: { status: 500 },
  });
  await store.markSending('action-retry');
  await store.markRetryScheduled({
    actionId: 'action-retry',
    reason: 'telegram_api_error',
    errorJson: { status: 500 },
  });
  await store.markSending('action-retry');
  const afterBudget = await store.markSending('action-retry');
  const failed = await store.markFailed({
    actionId: 'action-retry',
    reason: 'retry_budget_exhausted',
    errorJson: { status: 500 },
  });

  assert.equal(afterBudget, null);
  assert.equal(harness.state.rows[0]?.attemptCount, 3);
  assert.equal(failed.status, TELEGRAM_EGRESS_STATUS.FAILED);
  assert.equal(failed.lastErrorCode, 'retry_budget_exhausted');
});

void test('AC-F0029-13 AC-F0029-14 AC-F0029-16 does not automatically resend ambiguous sending rows', async () => {
  const harness = createHarness();
  const store = createTelegramEgressStore(harness.db);

  await store.recordIntent({
    actionId: 'action-interrupted',
    tickId: 'tick-interrupted',
    replyToStimulusId: 'stimulus-telegram-1',
    recipientChatIdHash: 'sha256:operator',
    text: 'recover interrupted send',
  });
  await store.markSending('action-interrupted');

  const activeClaim = await store.markSending('action-interrupted');
  const ready = await store.listReadyToRetry();
  const failed = await store.markFailed({
    actionId: 'action-interrupted',
    reason: 'telegram_api_timeout',
    errorJson: { reason: 'ambiguous_interrupted_send' },
  });

  assert.equal(activeClaim, null);
  assert.deepEqual(ready, []);
  assert.equal(failed.status, TELEGRAM_EGRESS_STATUS.FAILED);
  assert.equal(failed.lastErrorCode, 'telegram_api_timeout');
});

void test('AC-F0029-18 AC-F0029-19 records token-free refusal evidence', async () => {
  const harness = createHarness();
  const store = createTelegramEgressStore(harness.db);

  const row = await store.recordRefusal({
    actionId: 'action-refused',
    tickId: 'tick-refused',
    replyToStimulusId: 'stimulus-telegram-1',
    recipientChatIdHash: 'sha256:operator',
    text: 'refused',
    reason: 'text_too_long',
  });
  const serializedRows = JSON.stringify(harness.state.rows);

  assert.equal(row.status, TELEGRAM_EGRESS_STATUS.REFUSED);
  assert.equal(row.lastErrorCode, 'text_too_long');
  assert.equal(serializedRows.includes('bot-secret-token'), false);
});
