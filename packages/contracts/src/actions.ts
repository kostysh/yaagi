import { z } from 'zod';
import { decisionModeSchema, tickDecisionActionSchema } from './cognition.ts';

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const EXECUTION_PROFILE = Object.freeze({
  SAFE_DATA: 'safe_data',
  GIT_BODY: 'git_body',
  NETWORK_HTTP: 'network_http',
  RESTRICTED_SHELL: 'restricted_shell',
  JOB_ENQUEUE: 'job_enqueue',
  TELEGRAM_EGRESS: 'telegram_egress',
} as const);

export type ExecutionProfile = (typeof EXECUTION_PROFILE)[keyof typeof EXECUTION_PROFILE];

export const executionProfileSchema = z.enum([
  EXECUTION_PROFILE.SAFE_DATA,
  EXECUTION_PROFILE.GIT_BODY,
  EXECUTION_PROFILE.NETWORK_HTTP,
  EXECUTION_PROFILE.RESTRICTED_SHELL,
  EXECUTION_PROFILE.JOB_ENQUEUE,
  EXECUTION_PROFILE.TELEGRAM_EGRESS,
]);

export const TELEGRAM_SEND_MESSAGE_TOOL = 'telegram.sendMessage' as const;
export const TELEGRAM_SEND_MESSAGE_TEXT_LIMIT = 3500;
export const TELEGRAM_SEND_MESSAGE_RETRY_BUDGET = 3;

export const telegramSendMessageRefusalReasonSchema = z.enum([
  'telegram_egress_disabled',
  'operator_chat_not_configured',
  'operator_chat_not_allowed',
  'non_operator_recipient',
  'group_or_channel_context',
  'non_text_payload',
  'text_too_long',
]);

export type TelegramSendMessageRefusalReason = z.infer<
  typeof telegramSendMessageRefusalReasonSchema
>;

export const telegramSendMessageFailureReasonSchema = z.enum([
  'telegram_api_timeout',
  'telegram_api_error',
  'telegram_rate_limited',
  'telegram_bot_blocked',
  'telegram_invalid_token',
  'retry_budget_exhausted',
]);

export type TelegramSendMessageFailureReason = z.infer<
  typeof telegramSendMessageFailureReasonSchema
>;

const boundedTelegramTextSchema = z
  .string()
  .min(1)
  .refine((value) => [...value].length <= TELEGRAM_SEND_MESSAGE_TEXT_LIMIT, {
    message: `telegram.sendMessage text must be at most ${TELEGRAM_SEND_MESSAGE_TEXT_LIMIT} Unicode scalar values`,
  });

export const telegramSendMessageParametersSchema = z
  .object({
    text: boundedTelegramTextSchema,
    correlationId: z.string().min(1),
    replyToStimulusId: z.string().min(1),
    replyToTelegramUpdateId: z.number().int().safe().optional(),
  })
  .strict();

export type TelegramSendMessageParameters = z.infer<typeof telegramSendMessageParametersSchema>;

export const telegramSendMessageResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('sent'),
    actionId: z.string().min(1),
    egressMessageId: z.string().min(1),
    telegramMessageId: z.number().int().safe(),
    attemptCount: z.number().int().min(1).max(TELEGRAM_SEND_MESSAGE_RETRY_BUDGET),
  }),
  z.object({
    status: z.literal('refused'),
    actionId: z.string().min(1),
    reason: telegramSendMessageRefusalReasonSchema,
  }),
  z.object({
    status: z.literal('failed'),
    actionId: z.string().min(1),
    egressMessageId: z.string().min(1),
    reason: telegramSendMessageFailureReasonSchema,
    attemptCount: z.number().int().min(0).max(TELEGRAM_SEND_MESSAGE_RETRY_BUDGET),
  }),
]);

export type TelegramSendMessageResult = z.infer<typeof telegramSendMessageResultSchema>;

export const executiveVerdictKindSchema = z.enum([
  'tool_call',
  'schedule_job',
  'review_request',
  'conscious_inaction',
]);

export type ExecutiveVerdictKind = z.infer<typeof executiveVerdictKindSchema>;

export const executiveRefusalReasonSchema = z.enum([
  'unsupported_action_type',
  'unsupported_tool',
  'boundary_denied',
  'execution_timeout',
  'execution_failed',
  'review_required',
]);

export type ExecutiveRefusalReason = z.infer<typeof executiveRefusalReasonSchema>;

export const boundaryCheckSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().min(1),
  executionProfile: executionProfileSchema.optional(),
  deniedBy: z.string().min(1).optional(),
});

export type BoundaryCheck = z.infer<typeof boundaryCheckSchema>;

export const decisionActionInputSchema = z.object({
  tickId: z.string().min(1),
  decisionMode: decisionModeSchema,
  selectedModelProfileId: z.string().min(1),
  action: tickDecisionActionSchema,
});

export type DecisionActionInput = z.infer<typeof decisionActionInputSchema>;

export const toolInvocationRequestSchema = z.object({
  tickId: z.string().min(1),
  actionId: z.string().min(1),
  toolName: z.string().min(1).optional(),
  verdictKind: z.enum(['tool_call', 'schedule_job']),
  parametersJson: jsonRecordSchema,
});

export type ToolInvocationRequest = z.infer<typeof toolInvocationRequestSchema>;

export const executiveAcceptedSchema = z.object({
  accepted: z.literal(true),
  actionId: z.string().min(1),
  verdictKind: executiveVerdictKindSchema,
  boundaryCheck: boundaryCheckSchema,
  resultJson: jsonRecordSchema,
});

export const executiveRefusalSchema = z.object({
  accepted: z.literal(false),
  actionId: z.string().min(1),
  verdictKind: executiveVerdictKindSchema,
  boundaryCheck: boundaryCheckSchema,
  refusalReason: executiveRefusalReasonSchema,
  detail: z.string().min(1),
});

export const executiveVerdictSchema = z.discriminatedUnion('accepted', [
  executiveAcceptedSchema,
  executiveRefusalSchema,
]);

export type ExecutiveAccepted = z.infer<typeof executiveAcceptedSchema>;
export type ExecutiveRefusal = z.infer<typeof executiveRefusalSchema>;
export type ExecutiveVerdict = z.infer<typeof executiveVerdictSchema>;
