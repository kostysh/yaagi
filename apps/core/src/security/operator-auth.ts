import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  OPERATOR_AUTH_DECISION,
  OPERATOR_AUTH_DENIAL_REASON,
  OPERATOR_AUTH_UNAVAILABLE_REASON,
  OPERATOR_REF_MAX_LENGTH,
  OPERATOR_ROUTE_CLASS,
  OPERATOR_TOKEN_VERSION,
  isOperatorRouteClassAllowedForRoles,
  operatorAuthAuditEventRowSchema,
  operatorPrincipalFileSchema,
  operatorTrustedIngressEvidenceSchema,
  type OperatorAuthDenialReason,
  type OperatorAuthFailureReason,
  type OperatorAuthUnavailableReason,
  type OperatorCredentialRecord,
  type OperatorPrincipalFile,
  type OperatorPrincipalRecord,
  type OperatorRouteDescriptor,
  type OperatorTrustedIngressEvidence,
} from '@yaagi/contracts/operator-auth';
import type {
  RecordOperatorAuthAuditEventInput,
  RecordOperatorAuthAuditEventResult,
} from '@yaagi/db';

type RateLimitBucket = {
  windowStartMs: number;
  count: number;
  uniqueKeys: Set<string>;
};

type RateLimitDecision = {
  allowed: boolean;
  auditRejection: boolean;
};

type CredentialMatch = {
  principal: OperatorPrincipalRecord;
  credential: OperatorCredentialRecord;
};

export type OperatorAuthAuditRecorder = (
  input: RecordOperatorAuthAuditEventInput,
) => Promise<RecordOperatorAuthAuditEventResult>;

export type OperatorAuthServiceOptions = {
  principalsFilePath: string | null;
  recordAuditEvent?: OperatorAuthAuditRecorder;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  now?: () => Date;
  randomId?: () => string;
};

export type OperatorAdmissionInput = {
  request: Request;
  route: OperatorRouteDescriptor;
  requestId: string;
  requestedAt: string;
  rateLimitReplayKey?: string | null;
};

export type OperatorAdmissionResult =
  | {
      outcome: 'allow';
      evidence: OperatorTrustedIngressEvidence;
    }
  | {
      outcome: 'deny';
      reason: OperatorAuthDenialReason;
      requestId: string;
    }
  | {
      outcome: 'unavailable';
      reason: OperatorAuthUnavailableReason;
      requestId: string;
    };

export type OperatorAuthService = {
  admit(input: OperatorAdmissionInput): Promise<OperatorAdmissionResult>;
};

const OPERATOR_PRINCIPAL_FILE_CACHE_TTL_MS = 1_000;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const hashedRef = (prefix: string, value: string): string =>
  `${prefix}:${hashToken(value).slice(0, 48)}`;

const normalizeExternalRef = (prefix: string, value: string, fallback: () => string): string => {
  const trimmed = value.trim();
  const candidate = trimmed || fallback();
  if (candidate.length <= OPERATOR_REF_MAX_LENGTH) {
    return candidate;
  }

  return hashedRef(prefix, candidate);
};

const safeHashEqual = (leftHex: string, rightHex: string): boolean => {
  if (leftHex.length !== rightHex.length) {
    return false;
  }

  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
};

const extractBearerToken = (request: Request): string | null => {
  const header = request.headers.get('authorization');
  if (!header) {
    return null;
  }

  const match = /^bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
};

const tokenHasSupportedVersion = (token: string): boolean =>
  token.startsWith(`${OPERATOR_TOKEN_VERSION}_`);

const preAuthRateKey = (
  route: OperatorRouteDescriptor,
  bucket: 'missing_credential' | 'unsupported_token_version' | 'unknown_credential',
): string => `preauth:${bucket}:${route.method}:${route.path}`;

const isIsoAtOrBefore = (timestamp: string | null, now: Date): boolean =>
  timestamp !== null && Date.parse(timestamp) <= now.getTime();

const loadPrincipalFile = async (filePath: string): Promise<OperatorPrincipalFile> => {
  const raw = await readFile(filePath, 'utf8');
  return operatorPrincipalFileSchema.parse(JSON.parse(raw));
};

const findCredentialMatch = (
  principalFile: OperatorPrincipalFile,
  tokenSha256: string,
): CredentialMatch | null => {
  for (const principal of principalFile.principals) {
    for (const credential of principal.credentials) {
      if (safeHashEqual(credential.tokenSha256, tokenSha256)) {
        return { principal, credential };
      }
    }
  }

  return null;
};

const createFixedWindowLimiter = (windowMs: number, maxRequests: number) => {
  const buckets = new Map<string, RateLimitBucket>();

  const currentBucket = (key: string, nowMs: number): RateLimitBucket => {
    const current = buckets.get(key);
    if (!current || nowMs - current.windowStartMs >= windowMs) {
      const next = {
        windowStartMs: nowMs,
        count: 0,
        uniqueKeys: new Set<string>(),
      };
      buckets.set(key, next);
      return next;
    }

    return current;
  };

  const reject = (): RateLimitDecision => {
    return { allowed: false, auditRejection: true };
  };

  return {
    check(key: string, nowMs: number): RateLimitDecision {
      const bucket = currentBucket(key, nowMs);
      bucket.count += 1;
      if (bucket.count <= maxRequests) {
        return { allowed: true, auditRejection: false };
      }

      return reject();
    },
    checkUnique(key: string, uniqueKey: string, nowMs: number): RateLimitDecision {
      const bucket = currentBucket(key, nowMs);
      if (bucket.uniqueKeys.has(uniqueKey)) {
        return { allowed: true, auditRejection: false };
      }

      if (bucket.count >= maxRequests) {
        return reject();
      }

      bucket.uniqueKeys.add(uniqueKey);
      bucket.count += 1;
      return { allowed: true, auditRejection: false };
    },
  };
};

export const createOperatorAuthService = (
  options: OperatorAuthServiceOptions,
): OperatorAuthService => {
  const now = options.now ?? (() => new Date());
  const randomId = options.randomId ?? randomUUID;
  const limiter = createFixedWindowLimiter(options.rateLimitWindowMs, options.rateLimitMaxRequests);
  let principalFileCache: {
    loadedAtMs: number;
    principalFile: OperatorPrincipalFile;
  } | null = null;
  let principalFileLoad: Promise<OperatorPrincipalFile> | null = null;

  const loadCurrentPrincipalFile = async (loadedAtMs: number): Promise<OperatorPrincipalFile> => {
    if (
      principalFileCache &&
      loadedAtMs - principalFileCache.loadedAtMs < OPERATOR_PRINCIPAL_FILE_CACHE_TTL_MS
    ) {
      return principalFileCache.principalFile;
    }

    principalFileLoad ??= loadPrincipalFile(options.principalsFilePath ?? '').then(
      (principalFile) => {
        principalFileCache = { loadedAtMs, principalFile };
        return principalFile;
      },
    );

    try {
      return await principalFileLoad;
    } finally {
      principalFileLoad = null;
    }
  };

  const recordAudit = async (input: {
    requestId: string;
    principalRef: string | null;
    sessionRef: string | null;
    route: OperatorRouteDescriptor;
    decision: 'allow' | 'deny' | 'unavailable';
    denialReason: OperatorAuthFailureReason | null;
    evidenceRef: string | null;
    payloadJson?: Record<string, unknown>;
    createdAt: string;
  }): Promise<boolean> => {
    if (!options.recordAuditEvent) {
      return false;
    }

    try {
      const auditEvent = operatorAuthAuditEventRowSchema.parse({
        auditEventId: hashedRef(
          'operator-auth-audit',
          `${input.requestId}:${randomId()}:${input.createdAt}`,
        ),
        requestId: input.requestId,
        principalRef: input.principalRef,
        sessionRef: input.sessionRef,
        method: input.route.method,
        route: input.route.path,
        routeClass: input.route.routeClass,
        riskClass: input.route.riskClass,
        decision: input.decision,
        denialReason: input.denialReason,
        evidenceRef: input.evidenceRef,
        payloadJson: input.payloadJson ?? {},
        createdAt: input.createdAt,
      });
      await options.recordAuditEvent(auditEvent);
      return true;
    } catch {
      return false;
    }
  };

  const unavailable = async (
    input: OperatorAdmissionInput,
    reason: OperatorAuthUnavailableReason,
  ): Promise<OperatorAdmissionResult> => {
    const audited = await recordAudit({
      requestId: input.requestId,
      principalRef: null,
      sessionRef: null,
      route: input.route,
      decision: OPERATOR_AUTH_DECISION.UNAVAILABLE,
      denialReason: reason,
      evidenceRef: null,
      createdAt: input.requestedAt,
    });

    return {
      outcome: 'unavailable',
      reason: audited ? reason : OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_STORE_UNAVAILABLE,
      requestId: input.requestId,
    };
  };

  const deny = async (
    input: OperatorAdmissionInput,
    reason: OperatorAuthDenialReason,
    principalRef: string | null = null,
    sessionRef: string | null = null,
    payloadJson: Record<string, unknown> = {},
  ): Promise<OperatorAdmissionResult> => {
    const audited = await recordAudit({
      requestId: input.requestId,
      principalRef,
      sessionRef,
      route: input.route,
      decision: OPERATOR_AUTH_DECISION.DENY,
      denialReason: reason,
      evidenceRef: null,
      payloadJson,
      createdAt: input.requestedAt,
    });

    if (!audited) {
      return {
        outcome: 'unavailable',
        reason: OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_STORE_UNAVAILABLE,
        requestId: input.requestId,
      };
    }

    return { outcome: 'deny', reason, requestId: input.requestId };
  };

  const denyRateLimited = (
    input: OperatorAdmissionInput,
    decision: RateLimitDecision,
    principalRef: string | null = null,
    sessionRef: string | null = null,
    payloadJson: Record<string, unknown> = {},
  ): Promise<OperatorAdmissionResult> => {
    if (!decision.auditRejection) {
      return Promise.resolve({
        outcome: 'deny',
        reason: OPERATOR_AUTH_DENIAL_REASON.RATE_LIMITED,
        requestId: input.requestId,
      });
    }

    return deny(
      input,
      OPERATOR_AUTH_DENIAL_REASON.RATE_LIMITED,
      principalRef,
      sessionRef,
      payloadJson,
    );
  };

  return {
    async admit(input: OperatorAdmissionInput): Promise<OperatorAdmissionResult> {
      const admissionInput: OperatorAdmissionInput = {
        ...input,
        requestId: normalizeExternalRef('operator-request', input.requestId, randomId),
      };

      if (!options.principalsFilePath) {
        return unavailable(admissionInput, OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_CONFIG_MISSING);
      }

      const token = extractBearerToken(admissionInput.request);
      const timestamp = now();
      const replayKey = admissionInput.rateLimitReplayKey?.trim() || null;

      const denyPreAuth = (reason: OperatorAuthDenialReason): Promise<OperatorAdmissionResult> => {
        return deny(admissionInput, reason);
      };

      if (!token) {
        const preAuthDecision = limiter.check(
          preAuthRateKey(admissionInput.route, 'missing_credential'),
          timestamp.getTime(),
        );
        if (!preAuthDecision.allowed) {
          return denyRateLimited(admissionInput, preAuthDecision);
        }
        return denyPreAuth(OPERATOR_AUTH_DENIAL_REASON.UNAUTHENTICATED);
      }

      if (!tokenHasSupportedVersion(token)) {
        const preAuthDecision = limiter.check(
          preAuthRateKey(admissionInput.route, 'unsupported_token_version'),
          timestamp.getTime(),
        );
        if (!preAuthDecision.allowed) {
          return denyRateLimited(admissionInput, preAuthDecision);
        }
        return denyPreAuth(OPERATOR_AUTH_DENIAL_REASON.UNSUPPORTED_TOKEN_VERSION);
      }

      const tokenSha256 = hashToken(token);

      let principalFile: OperatorPrincipalFile;
      try {
        principalFile = await loadCurrentPrincipalFile(timestamp.getTime());
      } catch {
        return unavailable(admissionInput, OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_CONFIG_INVALID);
      }

      const matched = findCredentialMatch(principalFile, tokenSha256);
      if (!matched) {
        const unknownCredentialDecision = limiter.check(
          preAuthRateKey(admissionInput.route, 'unknown_credential'),
          timestamp.getTime(),
        );
        if (!unknownCredentialDecision.allowed) {
          return denyRateLimited(admissionInput, unknownCredentialDecision);
        }
        return denyPreAuth(OPERATOR_AUTH_DENIAL_REASON.UNAUTHENTICATED);
      }

      const sessionRef = hashedRef(
        'operator-session',
        `${matched.principal.principalRef}:${matched.credential.credentialRef}`,
      );
      const credentialPayload = {
        credentialRef: matched.credential.credentialRef,
      };
      if (isIsoAtOrBefore(matched.principal.revokedAt, timestamp)) {
        return deny(
          admissionInput,
          OPERATOR_AUTH_DENIAL_REASON.REVOKED,
          matched.principal.principalRef,
          sessionRef,
          credentialPayload,
        );
      }

      if (isIsoAtOrBefore(matched.credential.revokedAt, timestamp)) {
        return deny(
          admissionInput,
          OPERATOR_AUTH_DENIAL_REASON.REVOKED,
          matched.principal.principalRef,
          sessionRef,
          credentialPayload,
        );
      }

      if (isIsoAtOrBefore(matched.credential.expiresAt, timestamp)) {
        return deny(
          admissionInput,
          OPERATOR_AUTH_DENIAL_REASON.EXPIRED,
          matched.principal.principalRef,
          sessionRef,
          credentialPayload,
        );
      }

      if (
        !isOperatorRouteClassAllowedForRoles(
          matched.principal.roles,
          admissionInput.route.routeClass,
        )
      ) {
        return deny(
          admissionInput,
          OPERATOR_AUTH_DENIAL_REASON.FORBIDDEN,
          matched.principal.principalRef,
          sessionRef,
          credentialPayload,
        );
      }

      const principalRateKey = `principal:${matched.principal.principalRef}:${admissionInput.route.routeClass}`;
      const principalRateDecision =
        admissionInput.route.routeClass === OPERATOR_ROUTE_CLASS.TICK_CONTROL && replayKey
          ? limiter.checkUnique(principalRateKey, replayKey, timestamp.getTime())
          : limiter.check(principalRateKey, timestamp.getTime());
      if (!principalRateDecision.allowed) {
        return denyRateLimited(
          admissionInput,
          principalRateDecision,
          matched.principal.principalRef,
          sessionRef,
          credentialPayload,
        );
      }

      const evidence: OperatorTrustedIngressEvidence = operatorTrustedIngressEvidenceSchema.parse({
        evidenceRef: hashedRef(
          'operator-auth-evidence',
          `${admissionInput.requestId}:${sessionRef}:${admissionInput.route.method}:${admissionInput.route.path}`,
        ),
        principalRef: matched.principal.principalRef,
        sessionRef,
        requestId: admissionInput.requestId,
        method: admissionInput.route.method,
        route: admissionInput.route.path,
        routeClass: admissionInput.route.routeClass,
        riskClass: admissionInput.route.riskClass,
        admittedAt: admissionInput.requestedAt,
      });
      const audited = await recordAudit({
        requestId: admissionInput.requestId,
        principalRef: matched.principal.principalRef,
        sessionRef,
        route: admissionInput.route,
        decision: OPERATOR_AUTH_DECISION.ALLOW,
        denialReason: null,
        evidenceRef: evidence.evidenceRef,
        payloadJson: credentialPayload,
        createdAt: admissionInput.requestedAt,
      });

      if (!audited) {
        return {
          outcome: 'unavailable',
          reason: OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_STORE_UNAVAILABLE,
          requestId: admissionInput.requestId,
        };
      }

      return { outcome: 'allow', evidence };
    },
  };
};
