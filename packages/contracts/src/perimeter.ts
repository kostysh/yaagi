import { z } from 'zod';

export const PERIMETER_REQUEST_ID_MAX_LENGTH = 200;
export const PERIMETER_REF_MAX_LENGTH = 500;
export const PERIMETER_EVIDENCE_REF_MAX_LENGTH = 500;
export const PERIMETER_EVIDENCE_REF_MAX_COUNT = 100;
export const PERIMETER_POLICY_VERSION_MAX_LENGTH = 100;
export const PERIMETER_DECISION_REASON_MAX_LENGTH = 200;

const isoTimestampSchema = z.string().datetime({ offset: true });

export const PERIMETER_ACTION_CLASS = Object.freeze({
  FREEZE_DEVELOPMENT: 'freeze_development',
  FORCE_ROLLBACK: 'force_rollback',
  DISABLE_EXTERNAL_NETWORK: 'disable_external_network',
  CODE_OR_PROMOTION_CHANGE: 'code_or_promotion_change',
} as const);

export type PerimeterActionClass =
  (typeof PERIMETER_ACTION_CLASS)[keyof typeof PERIMETER_ACTION_CLASS];

export const PERIMETER_INGRESS_OWNER = Object.freeze({
  F_0013: 'F-0013',
  F_0016: 'F-0016',
  F_0017: 'F-0017',
  CF_025: 'CF-025',
  PLATFORM_RUNTIME: 'platform-runtime',
} as const);

export type PerimeterIngressOwner =
  (typeof PERIMETER_INGRESS_OWNER)[keyof typeof PERIMETER_INGRESS_OWNER];

export const PERIMETER_AUTHORITY_OWNER = Object.freeze({
  GOVERNOR: 'governor',
  HUMAN_OVERRIDE: 'human_override',
} as const);

export type PerimeterAuthorityOwner =
  (typeof PERIMETER_AUTHORITY_OWNER)[keyof typeof PERIMETER_AUTHORITY_OWNER];

export const PERIMETER_VERDICT = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  REQUIRE_HUMAN_REVIEW: 'require_human_review',
} as const);

export type PerimeterVerdict = (typeof PERIMETER_VERDICT)[keyof typeof PERIMETER_VERDICT];

export const PERIMETER_DECISION_REASON = Object.freeze({
  VERIFIED_AUTHORITY: 'verified_authority',
  TRUSTED_INGRESS_MISSING: 'trusted_ingress_missing',
  GOVERNOR_AUTHORITY_MISSING: 'governor_authority_missing',
  HUMAN_OVERRIDE_EVIDENCE_MISSING: 'human_override_evidence_missing',
  EXPLICIT_UNAVAILABLE: 'explicit_unavailable',
  DOWNSTREAM_OWNER_REQUIRED: 'downstream_owner_required',
} as const);

export type PerimeterDecisionReason =
  (typeof PERIMETER_DECISION_REASON)[keyof typeof PERIMETER_DECISION_REASON];

export const perimeterActionClassSchema = z.enum([
  PERIMETER_ACTION_CLASS.FREEZE_DEVELOPMENT,
  PERIMETER_ACTION_CLASS.FORCE_ROLLBACK,
  PERIMETER_ACTION_CLASS.DISABLE_EXTERNAL_NETWORK,
  PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
]);

export const perimeterIngressOwnerSchema = z.enum([
  PERIMETER_INGRESS_OWNER.F_0013,
  PERIMETER_INGRESS_OWNER.F_0016,
  PERIMETER_INGRESS_OWNER.F_0017,
  PERIMETER_INGRESS_OWNER.CF_025,
  PERIMETER_INGRESS_OWNER.PLATFORM_RUNTIME,
]);

export const perimeterAuthorityOwnerSchema = z.enum([
  PERIMETER_AUTHORITY_OWNER.GOVERNOR,
  PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE,
]);

export const perimeterVerdictSchema = z.enum([
  PERIMETER_VERDICT.ALLOW,
  PERIMETER_VERDICT.DENY,
  PERIMETER_VERDICT.REQUIRE_HUMAN_REVIEW,
]);

export const perimeterDecisionReasonSchema = z.enum([
  PERIMETER_DECISION_REASON.VERIFIED_AUTHORITY,
  PERIMETER_DECISION_REASON.TRUSTED_INGRESS_MISSING,
  PERIMETER_DECISION_REASON.GOVERNOR_AUTHORITY_MISSING,
  PERIMETER_DECISION_REASON.HUMAN_OVERRIDE_EVIDENCE_MISSING,
  PERIMETER_DECISION_REASON.EXPLICIT_UNAVAILABLE,
  PERIMETER_DECISION_REASON.DOWNSTREAM_OWNER_REQUIRED,
]);

export const perimeterEvidenceRefSchema = z.string().min(1).max(PERIMETER_EVIDENCE_REF_MAX_LENGTH);

const perimeterControlRequestBaseSchema = z.object({
  requestId: z.string().min(1).max(PERIMETER_REQUEST_ID_MAX_LENGTH),
  ingressOwner: perimeterIngressOwnerSchema,
  actionClass: perimeterActionClassSchema,
  targetRef: z.string().min(1).max(PERIMETER_REF_MAX_LENGTH).optional(),
  evidenceRefs: z.array(perimeterEvidenceRefSchema).min(1).max(PERIMETER_EVIDENCE_REF_MAX_COUNT),
});

const perimeterGovernorRequestSchema = perimeterControlRequestBaseSchema
  .extend({
    authorityOwner: z.literal(PERIMETER_AUTHORITY_OWNER.GOVERNOR),
    governorProposalId: z.string().min(1).max(PERIMETER_REF_MAX_LENGTH),
    governorDecisionRef: z.string().min(1).max(PERIMETER_REF_MAX_LENGTH),
  })
  .strict();

const perimeterHumanOverrideRequestSchema = perimeterControlRequestBaseSchema
  .extend({
    authorityOwner: z.literal(PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE),
    humanOverrideEvidenceRef: z.string().min(1).max(PERIMETER_REF_MAX_LENGTH),
  })
  .strict();

export const perimeterControlRequestSchema = z.discriminatedUnion('authorityOwner', [
  perimeterGovernorRequestSchema,
  perimeterHumanOverrideRequestSchema,
]);

export type PerimeterControlRequest = z.infer<typeof perimeterControlRequestSchema>;

export const perimeterDecisionRowSchema = z.object({
  decisionId: z.string().min(1),
  requestId: z.string().min(1).max(PERIMETER_REQUEST_ID_MAX_LENGTH),
  actionClass: perimeterActionClassSchema,
  ingressOwner: perimeterIngressOwnerSchema,
  authorityOwner: perimeterAuthorityOwnerSchema,
  governorProposalId: z.string().min(1).max(PERIMETER_REF_MAX_LENGTH).nullable(),
  governorDecisionRef: z.string().min(1).max(PERIMETER_REF_MAX_LENGTH).nullable(),
  humanOverrideEvidenceRef: z.string().min(1).max(PERIMETER_REF_MAX_LENGTH).nullable(),
  targetRef: z.string().min(1).max(PERIMETER_REF_MAX_LENGTH).nullable(),
  evidenceRefsJson: z.array(perimeterEvidenceRefSchema).max(PERIMETER_EVIDENCE_REF_MAX_COUNT),
  verdict: perimeterVerdictSchema,
  decisionReason: perimeterDecisionReasonSchema,
  policyVersion: z.string().min(1).max(PERIMETER_POLICY_VERSION_MAX_LENGTH),
  payloadJson: z.record(z.string(), z.unknown()),
  createdAt: isoTimestampSchema,
});

export type PerimeterDecisionRow = z.infer<typeof perimeterDecisionRowSchema>;

export const perimeterDecisionAcceptedSchema = z.object({
  accepted: z.literal(true),
  requestId: z.string().min(1).max(PERIMETER_REQUEST_ID_MAX_LENGTH),
  decisionId: z.string().min(1),
  actionClass: perimeterActionClassSchema,
  verdict: perimeterVerdictSchema,
  decisionReason: perimeterDecisionReasonSchema,
  deduplicated: z.boolean(),
  createdAt: isoTimestampSchema,
});

export const perimeterDecisionRejectedSchema = z.object({
  accepted: z.literal(false),
  requestId: z.string().min(1).max(PERIMETER_REQUEST_ID_MAX_LENGTH).optional(),
  reason: z.enum(['conflicting_request_id', 'persistence_unavailable']),
});

export const perimeterDecisionResultSchema = z.discriminatedUnion('accepted', [
  perimeterDecisionAcceptedSchema,
  perimeterDecisionRejectedSchema,
]);

export type PerimeterDecisionResult = z.infer<typeof perimeterDecisionResultSchema>;

export const safetyKernelActionPolicySchema = z.object({
  allowedIngressOwners: z.array(perimeterIngressOwnerSchema).min(1),
  allowedAuthorityOwners: z.array(perimeterAuthorityOwnerSchema).min(1),
});

export type SafetyKernelActionPolicy = z.infer<typeof safetyKernelActionPolicySchema>;

export const safetyKernelSchema = z.object({
  version: z.string().min(1).max(PERIMETER_POLICY_VERSION_MAX_LENGTH),
  forbiddenActions: z.object({
    explicitUnavailableActionClasses: z.array(perimeterActionClassSchema),
  }),
  networkEgress: z.object({
    disableExternalNetworkMode: z.enum(['explicit_unavailable']),
    publicRouteCreation: z.enum(['deny']),
  }),
  promotionChangeGates: z.object({
    actionPolicies: z.partialRecord(perimeterActionClassSchema, safetyKernelActionPolicySchema),
  }),
  budgetCeilings: z.object({
    maxEvidenceRefsPerRequest: z.number().int().positive(),
    maxPayloadBytes: z.number().int().positive(),
  }),
});

export type SafetyKernel = z.infer<typeof safetyKernelSchema>;
