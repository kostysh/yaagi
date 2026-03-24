import { z } from 'zod';
import { decisionModeSchema, tickDecisionActionSchema } from './cognition.ts';

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const EXECUTION_PROFILE = Object.freeze({
  SAFE_DATA: 'safe_data',
  GIT_BODY: 'git_body',
  NETWORK_HTTP: 'network_http',
  RESTRICTED_SHELL: 'restricted_shell',
  JOB_ENQUEUE: 'job_enqueue',
} as const);

export type ExecutionProfile = (typeof EXECUTION_PROFILE)[keyof typeof EXECUTION_PROFILE];

export const executionProfileSchema = z.enum([
  EXECUTION_PROFILE.SAFE_DATA,
  EXECUTION_PROFILE.GIT_BODY,
  EXECUTION_PROFILE.NETWORK_HTTP,
  EXECUTION_PROFILE.RESTRICTED_SHELL,
  EXECUTION_PROFILE.JOB_ENQUEUE,
]);

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
