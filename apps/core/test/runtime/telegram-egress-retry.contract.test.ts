import assert from 'node:assert/strict';
import test from 'node:test';
import { EXECUTION_PROFILE, TELEGRAM_SEND_MESSAGE_TOOL } from '@yaagi/contracts/actions';
import { replayReadyTelegramEgress } from '../../src/runtime/runtime-lifecycle.ts';

void test('AC-F0029-14 AC-F0029-15 AC-F0029-16 replays ready Telegram egress rows through the tool gateway', async () => {
  const executions: Array<{
    actionId: string;
    toolName: string | undefined;
    parametersJson: Record<string, unknown>;
  }> = [];
  const failedActions: Array<{ actionId: string; reason: string }> = [];

  const result = await replayReadyTelegramEgress({
    store: {
      listReadyToRetry: () =>
        Promise.resolve([
          {
            actionId: 'action-telegram-retry',
            tickId: 'tick-telegram-retry',
            replyToStimulusId: 'stimulus-telegram-retry',
            replyToTelegramUpdateId: 77,
            idempotencyKey: 'telegram.sendMessage:action-telegram-retry',
            textJson: {
              text: 'retry the operator reply',
            },
          },
          {
            actionId: 'action-telegram-explicit-retry',
            tickId: 'tick-telegram-retry',
            replyToStimulusId: 'stimulus-telegram-retry',
            replyToTelegramUpdateId: null,
            idempotencyKey: 'telegram.sendMessage:action-telegram-explicit-retry',
            textJson: {
              text: 'retry explicit non-delivery failure',
            },
          },
          {
            actionId: 'action-telegram-missing-text',
            tickId: 'tick-telegram-retry',
            replyToStimulusId: 'stimulus-telegram-retry',
            replyToTelegramUpdateId: null,
            idempotencyKey: 'telegram.sendMessage:action-telegram-missing-text',
            textJson: {},
          },
        ]),
      markFailed: (input) => {
        failedActions.push({
          actionId: input.actionId,
          reason: input.reason,
        });
        return Promise.resolve({
          actionId: input.actionId,
        });
      },
    },
    toolGateway: {
      execute: (input) => {
        executions.push({
          actionId: input.actionId,
          toolName: input.toolName,
          parametersJson: input.parametersJson,
        });

        return Promise.resolve({
          verdict: {
            accepted: true,
            actionId: input.actionId,
            verdictKind: 'tool_call',
            boundaryCheck: {
              allowed: true,
              executionProfile: EXECUTION_PROFILE.TELEGRAM_EGRESS,
              reason: 'telegram egress retry passed through the bounded gateway',
            },
            resultJson: {
              status: 'sent',
            },
          },
        });
      },
    },
  });

  assert.deepEqual(result, {
    scanned: 3,
    attempted: 2,
  });
  assert.deepEqual(executions, [
    {
      actionId: 'action-telegram-retry',
      toolName: TELEGRAM_SEND_MESSAGE_TOOL,
      parametersJson: {
        text: 'retry the operator reply',
        correlationId: 'telegram.sendMessage:action-telegram-retry',
        replyToStimulusId: 'stimulus-telegram-retry',
        replyToTelegramUpdateId: 77,
      },
    },
    {
      actionId: 'action-telegram-explicit-retry',
      toolName: TELEGRAM_SEND_MESSAGE_TOOL,
      parametersJson: {
        text: 'retry explicit non-delivery failure',
        correlationId: 'telegram.sendMessage:action-telegram-explicit-retry',
        replyToStimulusId: 'stimulus-telegram-retry',
      },
    },
  ]);
  assert.deepEqual(failedActions, [
    {
      actionId: 'action-telegram-missing-text',
      reason: 'telegram_api_error',
    },
  ]);
});
