import { z } from 'zod';

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const DECISION_MODE = Object.freeze({
  REACTIVE: 'reactive',
  DELIBERATIVE: 'deliberative',
  CONTEMPLATIVE: 'contemplative',
} as const);

export type DecisionMode = (typeof DECISION_MODE)[keyof typeof DECISION_MODE];

export const decisionModeSchema = z.enum([
  DECISION_MODE.REACTIVE,
  DECISION_MODE.DELIBERATIVE,
  DECISION_MODE.CONTEMPLATIVE,
]);

export const decisionRoleSchema = z.enum(['reflex', 'deliberation', 'reflection']);

export type DecisionRole = z.infer<typeof decisionRoleSchema>;

export const contextSectionMetaSchema = z.object({
  truncated: z.boolean(),
  sourceIds: z.array(z.string().min(1)),
  conflictMarkers: z.array(z.string().min(1)),
});

export type ContextSectionMeta = z.infer<typeof contextSectionMetaSchema>;

export const perceptualContextSchema = z.object({
  tickId: z.string().min(1),
  summary: z.string().min(1),
  urgency: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  resourcePressure: z.number().min(0).max(1),
});

export type PerceptualContext = z.infer<typeof perceptualContextSchema>;

export const decisionContextSchema = z.object({
  tickId: z.string().min(1),
  decisionMode: decisionModeSchema,
  selectedModelProfileId: z.string().min(1),
  selectedRole: decisionRoleSchema,
  perceptualContext: perceptualContextSchema,
  perceptualMeta: contextSectionMetaSchema,
  subjectState: z.object({
    subjectStateSchemaVersion: z.string().min(1),
    agentState: jsonRecordSchema,
    goals: z.array(jsonRecordSchema),
    beliefs: z.array(jsonRecordSchema),
    entities: z.array(jsonRecordSchema),
    relationships: z.array(jsonRecordSchema),
  }),
  subjectStateMeta: contextSectionMetaSchema,
  recentEpisodes: z.array(
    z.object({
      episodeId: z.string().min(1),
      tickId: z.string().min(1),
      summary: z.string().min(1),
      resultJson: jsonRecordSchema,
      createdAt: z.string().datetime({ offset: true }),
    }),
  ),
  episodeMeta: contextSectionMetaSchema,
  resourcePostureJson: jsonRecordSchema,
});

export type DecisionContext = z.infer<typeof decisionContextSchema>;

export const tickDecisionActionSchema = z.object({
  type: z.enum(['none', 'tool_call', 'reflect', 'schedule_job']),
  summary: z.string().min(1),
  tool: z.string().min(1).optional(),
  argsJson: jsonRecordSchema.optional(),
});

export type TickDecisionAction = z.infer<typeof tickDecisionActionSchema>;

export const tickDecisionV1Schema = z.object({
  observations: z.array(z.string().min(1)),
  interpretations: z.array(z.string().min(1)),
  action: tickDecisionActionSchema,
  episode: z.object({
    summary: z.string().min(1),
    importance: z.number().min(0).max(1),
  }),
  developmentHints: z.array(z.string().min(1)),
});

export type TickDecisionV1 = z.infer<typeof tickDecisionV1Schema>;

export const decisionRefusalReasonSchema = z.enum([
  'context_incompatible',
  'selected_profile_missing',
  'selected_profile_ineligible',
  'unsupported_decision_mode',
  'decision_schema_invalid',
]);

export type DecisionRefusalReason = z.infer<typeof decisionRefusalReasonSchema>;

export const decisionAcceptedSchema = z.object({
  accepted: z.literal(true),
  decision: tickDecisionV1Schema,
});

export const decisionRefusalSchema = z.object({
  accepted: z.literal(false),
  reason: decisionRefusalReasonSchema,
  detail: z.string().min(1),
});

export const decisionResultSchema = z.discriminatedUnion('accepted', [
  decisionAcceptedSchema,
  decisionRefusalSchema,
]);

export type DecisionAccepted = z.infer<typeof decisionAcceptedSchema>;
export type DecisionRefusal = z.infer<typeof decisionRefusalSchema>;
export type DecisionResult = z.infer<typeof decisionResultSchema>;
