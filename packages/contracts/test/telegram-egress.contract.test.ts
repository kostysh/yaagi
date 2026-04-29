import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXECUTION_PROFILE,
  TELEGRAM_SEND_MESSAGE_RETRY_BUDGET,
  TELEGRAM_SEND_MESSAGE_TEXT_LIMIT,
  TELEGRAM_SEND_MESSAGE_TOOL,
  executionProfileSchema,
  telegramSendMessageFailureReasonSchema,
  telegramSendMessageParametersSchema,
  telegramSendMessageRefusalReasonSchema,
  telegramSendMessageResultSchema,
} from '../src/actions.ts';

void test('AC-F0029-05 AC-F0029-06 defines text-only telegram.sendMessage parameters without caller recipient', () => {
  const parsed = telegramSendMessageParametersSchema.parse({
    text: 'bounded reply',
    correlationId: 'corr-1',
    replyToStimulusId: 'stimulus-1',
    replyToTelegramUpdateId: 42,
  });

  assert.equal(TELEGRAM_SEND_MESSAGE_TOOL, 'telegram.sendMessage');
  assert.equal(parsed.text, 'bounded reply');
  assert.equal(
    telegramSendMessageParametersSchema.safeParse({
      text: 'bounded reply',
      correlationId: 'corr-1',
      replyToStimulusId: 'stimulus-1',
      chatId: '999',
    }).success,
    false,
  );
  assert.equal(
    telegramSendMessageParametersSchema.safeParse({
      text: { rich: 'payload' },
      correlationId: 'corr-1',
      replyToStimulusId: 'stimulus-1',
    }).success,
    false,
  );
});

void test('AC-F0029-27 rejects telegram.sendMessage text over the Unicode scalar bound', () => {
  const exactBound = 'a'.repeat(TELEGRAM_SEND_MESSAGE_TEXT_LIMIT);
  assert.equal(
    telegramSendMessageParametersSchema.safeParse({
      text: exactBound,
      correlationId: 'corr-1',
      replyToStimulusId: 'stimulus-1',
    }).success,
    true,
  );

  assert.equal(
    telegramSendMessageParametersSchema.safeParse({
      text: `${exactBound}b`,
      correlationId: 'corr-1',
      replyToStimulusId: 'stimulus-1',
    }).success,
    false,
  );
});

void test('AC-F0029-01 exposes a dedicated telegram egress execution profile and result vocabulary', () => {
  assert.equal(executionProfileSchema.parse(EXECUTION_PROFILE.TELEGRAM_EGRESS), 'telegram_egress');
  assert.equal(TELEGRAM_SEND_MESSAGE_RETRY_BUDGET, 3);
  assert.deepEqual(telegramSendMessageRefusalReasonSchema.options.sort(), [
    'group_or_channel_context',
    'non_operator_recipient',
    'non_text_payload',
    'operator_chat_not_allowed',
    'operator_chat_not_configured',
    'telegram_egress_disabled',
    'text_too_long',
  ]);
  assert.deepEqual(telegramSendMessageFailureReasonSchema.options.sort(), [
    'retry_budget_exhausted',
    'telegram_api_error',
    'telegram_api_timeout',
    'telegram_bot_blocked',
    'telegram_invalid_token',
    'telegram_rate_limited',
  ]);

  assert.equal(
    telegramSendMessageResultSchema.safeParse({
      status: 'sent',
      actionId: 'action-1',
      egressMessageId: 'telegram-egress:action-1',
      telegramMessageId: 10,
      attemptCount: 1,
    }).success,
    true,
  );
});
