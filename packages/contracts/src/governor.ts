import { z } from 'zod';

export const DEVELOPMENT_GOVERNOR_REQUEST_ID_MAX_LENGTH = 200;
export const DEVELOPMENT_GOVERNOR_REASON_MAX_LENGTH = 2_000;
export const DEVELOPMENT_GOVERNOR_EVIDENCE_REF_MAX_LENGTH = 500;
export const DEVELOPMENT_GOVERNOR_EVIDENCE_REF_MAX_COUNT = 100;

export const DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE = Object.freeze({
  OPERATOR_API: 'operator_api',
  HOMEOSTAT: 'homeostat',
  RUNTIME: 'runtime',
  RECOVERY: 'recovery',
  WORKSHOP: 'workshop',
  HUMAN_OVERRIDE: 'human_override',
} as const);

export type DevelopmentGovernorOriginSurface =
  (typeof DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE)[keyof typeof DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE];

export const DEVELOPMENT_FREEZE_TRIGGER_KIND = Object.freeze({
  OPERATOR: 'operator',
  POLICY_AUTO: 'policy_auto',
} as const);

export type DevelopmentFreezeTriggerKind =
  (typeof DEVELOPMENT_FREEZE_TRIGGER_KIND)[keyof typeof DEVELOPMENT_FREEZE_TRIGGER_KIND];

export const DEVELOPMENT_FREEZE_STATE = Object.freeze({
  FROZEN: 'frozen',
} as const);

export type DevelopmentFreezeState =
  (typeof DEVELOPMENT_FREEZE_STATE)[keyof typeof DEVELOPMENT_FREEZE_STATE];

export const DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND = Object.freeze({
  FREEZE_CREATED: 'freeze_created',
  PROPOSAL_RECORDED: 'proposal_recorded',
  PROPOSAL_DECISION_RECORDED: 'proposal_decision_recorded',
} as const);

export type DevelopmentGovernorLedgerEntryKind =
  (typeof DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND)[keyof typeof DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND];

export const DEVELOPMENT_PROPOSAL_KIND = Object.freeze({
  MODEL_ADAPTER: 'model_adapter',
  SPECIALIST_MODEL: 'specialist_model',
  CODE_CHANGE: 'code_change',
  POLICY_CHANGE: 'policy_change',
} as const);

export type DevelopmentProposalKind =
  (typeof DEVELOPMENT_PROPOSAL_KIND)[keyof typeof DEVELOPMENT_PROPOSAL_KIND];

export const DEVELOPMENT_PROPOSAL_STATE = Object.freeze({
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DEFERRED: 'deferred',
  SUPERSEDED: 'superseded',
  EXECUTED: 'executed',
  ROLLED_BACK: 'rolled_back',
} as const);

export type DevelopmentProposalState =
  (typeof DEVELOPMENT_PROPOSAL_STATE)[keyof typeof DEVELOPMENT_PROPOSAL_STATE];

export const DEVELOPMENT_PROPOSAL_DECISION_KIND = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DEFERRED: 'deferred',
} as const);

export type DevelopmentProposalDecisionKind =
  (typeof DEVELOPMENT_PROPOSAL_DECISION_KIND)[keyof typeof DEVELOPMENT_PROPOSAL_DECISION_KIND];

export const developmentGovernorOriginSurfaceSchema = z.enum([
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HOMEOSTAT,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.RUNTIME,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.RECOVERY,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.WORKSHOP,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HUMAN_OVERRIDE,
]);

export const developmentFreezeTriggerKindSchema = z.enum([
  DEVELOPMENT_FREEZE_TRIGGER_KIND.OPERATOR,
  DEVELOPMENT_FREEZE_TRIGGER_KIND.POLICY_AUTO,
]);

export const developmentFreezeStateSchema = z.literal(DEVELOPMENT_FREEZE_STATE.FROZEN);

export const developmentGovernorEvidenceRefSchema = z
  .string()
  .min(1)
  .max(DEVELOPMENT_GOVERNOR_EVIDENCE_REF_MAX_LENGTH);

export const developmentFreezeCommandSchema = z.object({
  requestId: z.string().min(1).max(DEVELOPMENT_GOVERNOR_REQUEST_ID_MAX_LENGTH),
  triggerKind: developmentFreezeTriggerKindSchema,
  originSurface: developmentGovernorOriginSurfaceSchema,
  requestedBy: z.string().min(1),
  reason: z.string().min(1).max(DEVELOPMENT_GOVERNOR_REASON_MAX_LENGTH),
  evidenceRefs: z
    .array(developmentGovernorEvidenceRefSchema)
    .max(DEVELOPMENT_GOVERNOR_EVIDENCE_REF_MAX_COUNT)
    .default([]),
  requestedAt: z.string().datetime({ offset: true }),
});

export type DevelopmentFreezeCommand = z.infer<typeof developmentFreezeCommandSchema>;

export const developmentFreezeAcceptedSchema = z.object({
  accepted: z.literal(true),
  requestId: z.string().min(1).max(DEVELOPMENT_GOVERNOR_REQUEST_ID_MAX_LENGTH),
  freezeId: z.string().min(1),
  state: developmentFreezeStateSchema,
  triggerKind: developmentFreezeTriggerKindSchema,
  decisionOrigin: developmentFreezeTriggerKindSchema,
  deduplicated: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
});

export const developmentFreezeRejectedSchema = z.object({
  accepted: z.literal(false),
  requestId: z.string().min(1).max(DEVELOPMENT_GOVERNOR_REQUEST_ID_MAX_LENGTH).optional(),
  reason: z.enum([
    'conflicting_request_id',
    'invalid_request',
    'persistence_unavailable',
    'unsupported_reaction',
  ]),
});

export const developmentFreezeResultSchema = z.discriminatedUnion('accepted', [
  developmentFreezeAcceptedSchema,
  developmentFreezeRejectedSchema,
]);

export type DevelopmentFreezeAccepted = z.infer<typeof developmentFreezeAcceptedSchema>;
export type DevelopmentFreezeRejected = z.infer<typeof developmentFreezeRejectedSchema>;
export type DevelopmentFreezeResult = z.infer<typeof developmentFreezeResultSchema>;
