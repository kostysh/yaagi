import { z } from 'zod';

export const OPERATOR_AUTH_SCHEMA_VERSION = '2026-04-23.operator-auth.v1';
export const OPERATOR_TOKEN_VERSION = 'opk_v1';

export const OPERATOR_REF_MAX_LENGTH = 200;
export const OPERATOR_ROUTE_MAX_LENGTH = 200;
export const OPERATOR_AUDIT_REASON_MAX_LENGTH = 100;
export const OPERATOR_TOKEN_HASH_HEX_LENGTH = 64;

const isoTimestampSchema = z.string().datetime({ offset: true });
const nullableIsoTimestampSchema = isoTimestampSchema.nullable().default(null);
const jsonRecordSchema = z.record(z.string(), z.unknown());

export const OPERATOR_ROLE = Object.freeze({
  OBSERVER: 'observer',
  OPERATOR: 'operator',
  GOVERNOR_OPERATOR: 'governor_operator',
  ADMIN: 'admin',
  BREAKGLASS_ADMIN: 'breakglass_admin',
} as const);

export type OperatorRole = (typeof OPERATOR_ROLE)[keyof typeof OPERATOR_ROLE];

export const OPERATOR_ROUTE_CLASS = Object.freeze({
  PUBLIC_HEALTH: 'public_health',
  READ_INTROSPECTION: 'read_introspection',
  TICK_CONTROL: 'tick_control',
  GOVERNOR_SUBMISSION: 'governor_submission',
  HUMAN_OVERRIDE: 'human_override',
  ADMIN_AUTH: 'admin_auth',
} as const);

export type OperatorRouteClass = (typeof OPERATOR_ROUTE_CLASS)[keyof typeof OPERATOR_ROUTE_CLASS];

export const OPERATOR_RISK_CLASS = Object.freeze({
  PUBLIC: 'public',
  READ_ONLY: 'read_only',
  CONTROL: 'control',
  HIGH_RISK: 'high_risk',
  ADMIN: 'admin',
} as const);

export type OperatorRiskClass = (typeof OPERATOR_RISK_CLASS)[keyof typeof OPERATOR_RISK_CLASS];

export const OPERATOR_AUTH_DECISION = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  UNAVAILABLE: 'unavailable',
} as const);

export type OperatorAuthDecision =
  (typeof OPERATOR_AUTH_DECISION)[keyof typeof OPERATOR_AUTH_DECISION];

export const OPERATOR_AUTH_DENIAL_REASON = Object.freeze({
  UNAUTHENTICATED: 'unauthenticated',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  FORBIDDEN: 'forbidden',
  RATE_LIMITED: 'rate_limited',
  UNSUPPORTED_ROUTE: 'unsupported_route',
  UNSUPPORTED_TOKEN_VERSION: 'unsupported_token_version',
} as const);

export type OperatorAuthDenialReason =
  (typeof OPERATOR_AUTH_DENIAL_REASON)[keyof typeof OPERATOR_AUTH_DENIAL_REASON];

export const OPERATOR_AUTH_UNAVAILABLE_REASON = Object.freeze({
  AUTH_CONFIG_MISSING: 'auth_config_missing',
  AUTH_CONFIG_INVALID: 'auth_config_invalid',
  AUTH_STORE_UNAVAILABLE: 'auth_store_unavailable',
  DOWNSTREAM_OWNER_UNAVAILABLE: 'downstream_owner_unavailable',
} as const);

export type OperatorAuthUnavailableReason =
  (typeof OPERATOR_AUTH_UNAVAILABLE_REASON)[keyof typeof OPERATOR_AUTH_UNAVAILABLE_REASON];

export type OperatorAuthFailureReason = OperatorAuthDenialReason | OperatorAuthUnavailableReason;

export const operatorRoleSchema = z.enum([
  OPERATOR_ROLE.OBSERVER,
  OPERATOR_ROLE.OPERATOR,
  OPERATOR_ROLE.GOVERNOR_OPERATOR,
  OPERATOR_ROLE.ADMIN,
  OPERATOR_ROLE.BREAKGLASS_ADMIN,
]);

export const operatorRouteClassSchema = z.enum([
  OPERATOR_ROUTE_CLASS.PUBLIC_HEALTH,
  OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
  OPERATOR_ROUTE_CLASS.TICK_CONTROL,
  OPERATOR_ROUTE_CLASS.GOVERNOR_SUBMISSION,
  OPERATOR_ROUTE_CLASS.HUMAN_OVERRIDE,
  OPERATOR_ROUTE_CLASS.ADMIN_AUTH,
]);

export const operatorRiskClassSchema = z.enum([
  OPERATOR_RISK_CLASS.PUBLIC,
  OPERATOR_RISK_CLASS.READ_ONLY,
  OPERATOR_RISK_CLASS.CONTROL,
  OPERATOR_RISK_CLASS.HIGH_RISK,
  OPERATOR_RISK_CLASS.ADMIN,
]);

export const operatorAuthDecisionSchema = z.enum([
  OPERATOR_AUTH_DECISION.ALLOW,
  OPERATOR_AUTH_DECISION.DENY,
  OPERATOR_AUTH_DECISION.UNAVAILABLE,
]);

export const operatorAuthDenialReasonSchema = z.enum([
  OPERATOR_AUTH_DENIAL_REASON.UNAUTHENTICATED,
  OPERATOR_AUTH_DENIAL_REASON.EXPIRED,
  OPERATOR_AUTH_DENIAL_REASON.REVOKED,
  OPERATOR_AUTH_DENIAL_REASON.FORBIDDEN,
  OPERATOR_AUTH_DENIAL_REASON.RATE_LIMITED,
  OPERATOR_AUTH_DENIAL_REASON.UNSUPPORTED_ROUTE,
  OPERATOR_AUTH_DENIAL_REASON.UNSUPPORTED_TOKEN_VERSION,
]);

export const operatorAuthUnavailableReasonSchema = z.enum([
  OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_CONFIG_MISSING,
  OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_CONFIG_INVALID,
  OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_STORE_UNAVAILABLE,
  OPERATOR_AUTH_UNAVAILABLE_REASON.DOWNSTREAM_OWNER_UNAVAILABLE,
]);

export const operatorAuthFailureReasonSchema = z.union([
  operatorAuthDenialReasonSchema,
  operatorAuthUnavailableReasonSchema,
]);

export const operatorRouteDescriptorSchema = z
  .object({
    method: z.enum(['GET', 'POST']),
    path: z.string().min(1).max(OPERATOR_ROUTE_MAX_LENGTH),
    routeClass: operatorRouteClassSchema,
    riskClass: operatorRiskClassSchema,
  })
  .strict();

export type OperatorRouteDescriptor = z.infer<typeof operatorRouteDescriptorSchema>;

export const OPERATOR_ROUTE_DESCRIPTORS = [
  {
    method: 'GET',
    path: '/health',
    routeClass: OPERATOR_ROUTE_CLASS.PUBLIC_HEALTH,
    riskClass: OPERATOR_RISK_CLASS.PUBLIC,
  },
  {
    method: 'GET',
    path: '/state',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
  },
  {
    method: 'GET',
    path: '/timeline',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
  },
  {
    method: 'GET',
    path: '/episodes',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
  },
  {
    method: 'GET',
    path: '/models',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
  },
  {
    method: 'GET',
    path: '/reports',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
  },
  {
    method: 'POST',
    path: '/control/tick',
    routeClass: OPERATOR_ROUTE_CLASS.TICK_CONTROL,
    riskClass: OPERATOR_RISK_CLASS.CONTROL,
  },
  {
    method: 'POST',
    path: '/control/freeze-development',
    routeClass: OPERATOR_ROUTE_CLASS.GOVERNOR_SUBMISSION,
    riskClass: OPERATOR_RISK_CLASS.HIGH_RISK,
  },
  {
    method: 'POST',
    path: '/control/development-proposals',
    routeClass: OPERATOR_ROUTE_CLASS.GOVERNOR_SUBMISSION,
    riskClass: OPERATOR_RISK_CLASS.HIGH_RISK,
  },
] as const satisfies readonly OperatorRouteDescriptor[];

export const OPERATOR_ROLE_ROUTE_CLASS_PERMISSIONS: Readonly<
  Record<OperatorRole, readonly OperatorRouteClass[]>
> = Object.freeze({
  [OPERATOR_ROLE.OBSERVER]: [OPERATOR_ROUTE_CLASS.READ_INTROSPECTION],
  [OPERATOR_ROLE.OPERATOR]: [
    OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    OPERATOR_ROUTE_CLASS.TICK_CONTROL,
  ],
  [OPERATOR_ROLE.GOVERNOR_OPERATOR]: [OPERATOR_ROUTE_CLASS.GOVERNOR_SUBMISSION],
  [OPERATOR_ROLE.ADMIN]: [OPERATOR_ROUTE_CLASS.ADMIN_AUTH],
  [OPERATOR_ROLE.BREAKGLASS_ADMIN]: [OPERATOR_ROUTE_CLASS.HUMAN_OVERRIDE],
});

const normalizeRoutePath = (route: string): string => {
  const parsed = new URL(route, 'http://operator.local');
  const path = parsed.pathname;
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
};

export const classifyOperatorRoute = (
  method: string,
  route: string,
): OperatorRouteDescriptor | null => {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = normalizeRoutePath(route);

  return (
    OPERATOR_ROUTE_DESCRIPTORS.find(
      (descriptor) => descriptor.method === normalizedMethod && descriptor.path === normalizedPath,
    ) ?? null
  );
};

export const isOperatorRouteClassAllowedForRoles = (
  roles: readonly OperatorRole[],
  routeClass: OperatorRouteClass,
): boolean =>
  roles.some((role) => OPERATOR_ROLE_ROUTE_CLASS_PERMISSIONS[role]?.includes(routeClass) ?? false);

export const operatorCredentialRecordSchema = z
  .object({
    credentialRef: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH),
    tokenVersion: z.literal(OPERATOR_TOKEN_VERSION).default(OPERATOR_TOKEN_VERSION),
    tokenSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .length(OPERATOR_TOKEN_HASH_HEX_LENGTH),
    expiresAt: nullableIsoTimestampSchema,
    revokedAt: nullableIsoTimestampSchema,
  })
  .strict();

export type OperatorCredentialRecord = z.infer<typeof operatorCredentialRecordSchema>;

export const operatorPrincipalRecordSchema = z
  .object({
    principalRef: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH),
    roles: z.array(operatorRoleSchema).min(1),
    revokedAt: nullableIsoTimestampSchema,
    credentials: z.array(operatorCredentialRecordSchema).min(1),
  })
  .strict();

export type OperatorPrincipalRecord = z.infer<typeof operatorPrincipalRecordSchema>;

export const operatorPrincipalFileSchema = z
  .object({
    schemaVersion: z.literal(OPERATOR_AUTH_SCHEMA_VERSION),
    principals: z.array(operatorPrincipalRecordSchema),
  })
  .strict()
  .superRefine((file, context) => {
    const principalRefs = new Set<string>();
    const credentialRefs = new Set<string>();
    const tokenHashes = new Set<string>();

    file.principals.forEach((principal, principalIndex) => {
      if (principalRefs.has(principal.principalRef)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['principals', principalIndex, 'principalRef'],
          message: `duplicate operator principalRef ${principal.principalRef}`,
        });
      }
      principalRefs.add(principal.principalRef);

      principal.credentials.forEach((credential, credentialIndex) => {
        if (credentialRefs.has(credential.credentialRef)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['principals', principalIndex, 'credentials', credentialIndex, 'credentialRef'],
            message: `duplicate operator credentialRef ${credential.credentialRef}`,
          });
        }
        credentialRefs.add(credential.credentialRef);

        if (tokenHashes.has(credential.tokenSha256)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['principals', principalIndex, 'credentials', credentialIndex, 'tokenSha256'],
            message: 'duplicate operator credential tokenSha256',
          });
        }
        tokenHashes.add(credential.tokenSha256);
      });
    });
  });

export type OperatorPrincipalFile = z.infer<typeof operatorPrincipalFileSchema>;

export const operatorTrustedIngressEvidenceSchema = z
  .object({
    evidenceRef: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH),
    principalRef: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH),
    sessionRef: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH),
    requestId: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH),
    method: z.string().min(1).max(10),
    route: z.string().min(1).max(OPERATOR_ROUTE_MAX_LENGTH),
    routeClass: operatorRouteClassSchema,
    riskClass: operatorRiskClassSchema,
    admittedAt: isoTimestampSchema,
  })
  .strict();

export type OperatorTrustedIngressEvidence = z.infer<typeof operatorTrustedIngressEvidenceSchema>;

export const operatorAuthAuditEventRowSchema = z
  .object({
    auditEventId: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH),
    requestId: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH),
    principalRef: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH).nullable(),
    sessionRef: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH).nullable(),
    method: z.string().min(1).max(10),
    route: z.string().min(1).max(OPERATOR_ROUTE_MAX_LENGTH),
    routeClass: operatorRouteClassSchema,
    riskClass: operatorRiskClassSchema,
    decision: operatorAuthDecisionSchema,
    denialReason: operatorAuthFailureReasonSchema.nullable(),
    evidenceRef: z.string().min(1).max(OPERATOR_REF_MAX_LENGTH).nullable(),
    payloadJson: jsonRecordSchema,
    createdAt: isoTimestampSchema,
  })
  .strict();

export type OperatorAuthAuditEventRow = z.infer<typeof operatorAuthAuditEventRowSchema>;
