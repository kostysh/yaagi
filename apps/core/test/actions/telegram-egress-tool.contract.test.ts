import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  TELEGRAM_EGRESS_STATUS,
  type TelegramEgressMessageRow,
  type TelegramEgressStore,
} from '@yaagi/db';
import { createPhase0ToolGateway } from '../../src/actions/index.ts';
import { createActionTestConfig } from '../../testing/action-test-config.ts';

const now = '2026-04-29T12:00:00.000Z';

const createRow = (input: {
  actionId: string;
  tickId: string;
  replyToStimulusId: string;
  recipientChatIdHash: string;
  text: string;
  status?: TelegramEgressMessageRow['status'];
}): TelegramEgressMessageRow => ({
  egressMessageId: `telegram-egress:${input.actionId}`,
  actionId: input.actionId,
  tickId: input.tickId,
  replyToStimulusId: input.replyToStimulusId,
  replyToTelegramUpdateId: null,
  recipientKind: 'operator_direct_chat',
  recipientChatIdHash: input.recipientChatIdHash,
  textJson: { text: input.text },
  idempotencyKey: `telegram.sendMessage:${input.actionId}`,
  status: input.status ?? TELEGRAM_EGRESS_STATUS.PENDING,
  attemptCount: 0,
  nextAttemptAt: null,
  telegramMessageId: null,
  lastErrorCode: null,
  lastErrorJson: {},
  createdAt: now,
  updatedAt: now,
  sentAt: null,
});

const createFakeTelegramStore = (
  stimulus: Awaited<ReturnType<TelegramEgressStore['getStimulusContext']>>,
) => {
  const rows = new Map<string, TelegramEgressMessageRow>();
  const events: string[] = [];
  const store: Pick<
    TelegramEgressStore,
    | 'getStimulusContext'
    | 'getByActionId'
    | 'recordIntent'
    | 'recordRefusal'
    | 'markSending'
    | 'markSent'
    | 'markRetryScheduled'
    | 'markFailed'
  > = {
    getStimulusContext: () => Promise.resolve(stimulus),
    getByActionId: (actionId) => Promise.resolve(rows.get(actionId) ?? null),
    recordIntent: (input) => {
      events.push('intent');
      const existing = rows.get(input.actionId);
      if (existing) return Promise.resolve(existing);
      const row = createRow({
        actionId: input.actionId,
        tickId: input.tickId,
        replyToStimulusId: input.replyToStimulusId,
        recipientChatIdHash: input.recipientChatIdHash,
        text: input.text,
      });
      rows.set(input.actionId, row);
      return Promise.resolve(row);
    },
    recordRefusal: (input) => {
      events.push(`refusal:${input.reason}`);
      const row = createRow({
        actionId: input.actionId,
        tickId: input.tickId,
        replyToStimulusId: input.replyToStimulusId ?? 'unavailable',
        recipientChatIdHash: input.recipientChatIdHash ?? 'unavailable',
        text: input.text ?? '',
        status: TELEGRAM_EGRESS_STATUS.REFUSED,
      });
      row.lastErrorCode = input.reason;
      rows.set(input.actionId, row);
      return Promise.resolve(row);
    },
    markSending: (actionId) => {
      events.push('sending');
      const row = rows.get(actionId);
      assert.ok(row);
      row.status = TELEGRAM_EGRESS_STATUS.SENDING;
      row.attemptCount += 1;
      return Promise.resolve(row);
    },
    markSent: ({ actionId, telegramMessageId }) => {
      events.push('sent');
      const row = rows.get(actionId);
      assert.ok(row);
      row.status = TELEGRAM_EGRESS_STATUS.SENT;
      row.telegramMessageId = telegramMessageId;
      return Promise.resolve(row);
    },
    markRetryScheduled: ({ actionId, reason, errorJson }) => {
      events.push(`retry:${reason}`);
      const row = rows.get(actionId);
      assert.ok(row);
      row.status = TELEGRAM_EGRESS_STATUS.RETRY_SCHEDULED;
      row.lastErrorCode = reason;
      row.lastErrorJson = errorJson ?? {};
      return Promise.resolve(row);
    },
    markFailed: ({ actionId, reason, errorJson }) => {
      events.push(`failed:${reason}`);
      const row = rows.get(actionId);
      assert.ok(row);
      row.status = TELEGRAM_EGRESS_STATUS.FAILED;
      row.lastErrorCode = reason;
      row.lastErrorJson = errorJson ?? {};
      return Promise.resolve(row);
    },
  };

  return { store, rows, events };
};

const operatorStimulus = {
  stimulusId: 'stimulus-operator',
  sourceKind: 'telegram',
  threadId: '12345',
  payloadJson: { chatId: '12345', chatType: 'private', updateId: 9 },
  normalizedJson: {},
};

void test('AC-F0029-26 refuses disabled telegram egress before Bot API transport', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0029-disabled-'));
  const config = {
    ...createActionTestConfig(rootDir),
    telegramEgressEnabled: false,
    telegramOperatorChatId: '12345',
    telegramAllowedChatIds: ['12345'],
    telegramBotToken: 'secret-token',
  };
  const fakeStore = createFakeTelegramStore(operatorStimulus);
  let fetchCalled = false;
  const gateway = createPhase0ToolGateway({
    config,
    telegramEgressStore: fakeStore.store,
    fetchImpl: () => {
      fetchCalled = true;
      return Promise.resolve(new Response('{}', { status: 200 }));
    },
  });

  const result = await gateway.execute({
    tickId: 'tick-1',
    actionId: 'action-disabled',
    verdictKind: 'tool_call',
    toolName: 'telegram.sendMessage',
    parametersJson: {
      text: 'hello',
      correlationId: 'corr-1',
      replyToStimulusId: 'stimulus-operator',
    },
  });

  assert.equal(result.verdict.accepted, false);
  assert.equal(fetchCalled, false);
  assert.deepEqual(fakeStore.events, ['refusal:telegram_egress_disabled']);
});

void test('AC-F0029-05 AC-F0029-07 AC-F0029-08 AC-F0029-27 denies invalid telegram recipients and payloads before transport', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0029-deny-'));
  const config = {
    ...createActionTestConfig(rootDir),
    telegramEgressEnabled: true,
    telegramOperatorChatId: '12345',
    telegramAllowedChatIds: ['12345'],
    telegramBotToken: 'secret-token',
  };
  const groupStore = createFakeTelegramStore({
    ...operatorStimulus,
    payloadJson: { chatId: '12345', chatType: 'group', updateId: 10 },
  });
  const nonOperatorStore = createFakeTelegramStore({
    ...operatorStimulus,
    payloadJson: { chatId: '999', chatType: 'private', updateId: 11 },
  });
  let fetchCount = 0;
  const makeGateway = (store: typeof groupStore.store) =>
    createPhase0ToolGateway({
      config,
      telegramEgressStore: store,
      fetchImpl: () => {
        fetchCount += 1;
        return Promise.resolve(new Response('{}', { status: 200 }));
      },
    });

  const groupResult = await makeGateway(groupStore.store).execute({
    tickId: 'tick-group',
    actionId: 'action-group',
    verdictKind: 'tool_call',
    toolName: 'telegram.sendMessage',
    parametersJson: {
      text: 'hello',
      correlationId: 'corr-group',
      replyToStimulusId: 'stimulus-operator',
    },
  });
  const nonOperatorResult = await makeGateway(nonOperatorStore.store).execute({
    tickId: 'tick-other',
    actionId: 'action-other',
    verdictKind: 'tool_call',
    toolName: 'telegram.sendMessage',
    parametersJson: {
      text: 'hello',
      correlationId: 'corr-other',
      replyToStimulusId: 'stimulus-operator',
    },
  });
  const recipientResult = await makeGateway(
    createFakeTelegramStore(operatorStimulus).store,
  ).execute({
    tickId: 'tick-recipient',
    actionId: 'action-recipient',
    verdictKind: 'tool_call',
    toolName: 'telegram.sendMessage',
    parametersJson: {
      text: 'hello',
      correlationId: 'corr-recipient',
      replyToStimulusId: 'stimulus-operator',
      chatId: '999',
    },
  });
  const longTextResult = await makeGateway(createFakeTelegramStore(operatorStimulus).store).execute(
    {
      tickId: 'tick-long',
      actionId: 'action-long',
      verdictKind: 'tool_call',
      toolName: 'telegram.sendMessage',
      parametersJson: {
        text: 'a'.repeat(3501),
        correlationId: 'corr-long',
        replyToStimulusId: 'stimulus-operator',
      },
    },
  );

  assert.equal(groupResult.verdict.accepted, false);
  assert.equal(nonOperatorResult.verdict.accepted, false);
  assert.equal(recipientResult.verdict.accepted, false);
  assert.equal(longTextResult.verdict.accepted, false);
  assert.equal(fetchCount, 0);
});

void test('AC-F0029-11 AC-F0029-17 AC-F0029-19 sends only after outbox intent and records token-free result', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0029-send-'));
  const config = {
    ...createActionTestConfig(rootDir),
    telegramEgressEnabled: true,
    telegramOperatorChatId: '12345',
    telegramAllowedChatIds: ['12345'],
    telegramBotToken: 'secret-token',
    telegramApiBaseUrl: 'http://fake-telegram-api.local',
  };
  const fakeStore = createFakeTelegramStore(operatorStimulus);
  const gateway = createPhase0ToolGateway({
    config,
    telegramEgressStore: fakeStore.store,
    fetchImpl: (_url, init) => {
      assert.deepEqual(fakeStore.events, ['intent', 'sending']);
      assert.equal(JSON.stringify(init).includes('secret-token'), false);
      return Promise.resolve(
        Response.json({
          ok: true,
          result: {
            message_id: 1000,
          },
        }),
      );
    },
  });

  const result = await gateway.execute({
    tickId: 'tick-send',
    actionId: 'action-send',
    verdictKind: 'tool_call',
    toolName: 'telegram.sendMessage',
    parametersJson: {
      text: 'hello operator',
      correlationId: 'corr-send',
      replyToStimulusId: 'stimulus-operator',
    },
  });

  assert.equal(result.verdict.accepted, true);
  assert.deepEqual(fakeStore.events, ['intent', 'sending', 'sent']);
  assert.equal(JSON.stringify([...fakeStore.rows.values()]).includes('secret-token'), false);
});

void test('AC-F0029-11 AC-F0029-12 sends the durable outbox text on action replay', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0029-durable-text-'));
  const config = {
    ...createActionTestConfig(rootDir),
    telegramEgressEnabled: true,
    telegramOperatorChatId: '12345',
    telegramAllowedChatIds: ['12345'],
    telegramBotToken: 'secret-token',
    telegramApiBaseUrl: 'http://fake-telegram-api.local',
  };
  const fakeStore = createFakeTelegramStore(operatorStimulus);
  fakeStore.rows.set(
    'action-durable-text',
    createRow({
      actionId: 'action-durable-text',
      tickId: 'tick-durable-text',
      replyToStimulusId: 'stimulus-operator',
      recipientChatIdHash: 'sha256:operator',
      text: 'stored text',
    }),
  );
  const gateway = createPhase0ToolGateway({
    config,
    telegramEgressStore: fakeStore.store,
    fetchImpl: (_url, init) => {
      const bodyInit = init?.body;
      assert.equal(typeof bodyInit, 'string');
      if (typeof bodyInit !== 'string') {
        throw new Error('expected Telegram send body to be serialized JSON');
      }
      const body = JSON.parse(bodyInit) as Record<string, unknown>;
      assert.equal(body['text'], 'stored text');
      return Promise.resolve(
        Response.json({
          ok: true,
          result: {
            message_id: 1001,
          },
        }),
      );
    },
  });

  const result = await gateway.execute({
    tickId: 'tick-durable-text',
    actionId: 'action-durable-text',
    verdictKind: 'tool_call',
    toolName: 'telegram.sendMessage',
    parametersJson: {
      text: 'conflicting replay text',
      correlationId: 'corr-durable-text',
      replyToStimulusId: 'stimulus-operator',
    },
  });

  assert.equal(result.verdict.accepted, true);
  assert.deepEqual(fakeStore.events, ['intent', 'sending', 'sent']);
});

void test('AC-F0029-12 AC-F0029-14 does not call Bot API when send claim is already active', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0029-active-claim-'));
  const config = {
    ...createActionTestConfig(rootDir),
    telegramEgressEnabled: true,
    telegramOperatorChatId: '12345',
    telegramAllowedChatIds: ['12345'],
    telegramBotToken: 'secret-token',
    telegramApiBaseUrl: 'http://fake-telegram-api.local',
  };
  const fakeStore = createFakeTelegramStore(operatorStimulus);
  const gateway = createPhase0ToolGateway({
    config,
    telegramEgressStore: {
      ...fakeStore.store,
      markSending: (actionId) => {
        fakeStore.events.push(`sending-claim-miss:${actionId}`);
        return Promise.resolve(null);
      },
    },
    fetchImpl: () => {
      throw new Error('Bot API transport must not be called without an exclusive send claim');
    },
  });

  const result = await gateway.execute({
    tickId: 'tick-active-claim',
    actionId: 'action-active-claim',
    verdictKind: 'tool_call',
    toolName: 'telegram.sendMessage',
    parametersJson: {
      text: 'hello operator',
      correlationId: 'corr-active-claim',
      replyToStimulusId: 'stimulus-operator',
    },
  });

  assert.equal(result.verdict.accepted, false);
  assert.deepEqual(fakeStore.events, ['intent', 'sending-claim-miss:action-active-claim']);
});

void test('AC-F0029-13 AC-F0029-14 records ambiguous Telegram timeout as terminal failure', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0029-timeout-terminal-'));
  const config = {
    ...createActionTestConfig(rootDir),
    telegramEgressEnabled: true,
    telegramOperatorChatId: '12345',
    telegramAllowedChatIds: ['12345'],
    telegramBotToken: 'secret-token',
    telegramApiBaseUrl: 'http://fake-telegram-api.local',
  };
  const fakeStore = createFakeTelegramStore(operatorStimulus);
  const gateway = createPhase0ToolGateway({
    config,
    telegramEgressStore: fakeStore.store,
    fetchImpl: (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        assert.ok(signal);
        signal.addEventListener('abort', () => {
          reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
        });
      }),
  });

  const result = await gateway.execute({
    tickId: 'tick-timeout-terminal',
    actionId: 'action-timeout-terminal',
    verdictKind: 'tool_call',
    toolName: 'telegram.sendMessage',
    parametersJson: {
      text: 'hello operator',
      correlationId: 'corr-timeout-terminal',
      replyToStimulusId: 'stimulus-operator',
    },
  });

  assert.equal(result.verdict.accepted, false);
  assert.deepEqual(fakeStore.events, ['intent', 'sending', 'failed:telegram_api_timeout']);
  assert.equal(
    fakeStore.rows.get('action-timeout-terminal')?.status,
    TELEGRAM_EGRESS_STATUS.FAILED,
  );
});
