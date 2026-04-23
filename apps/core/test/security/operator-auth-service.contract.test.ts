import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERATOR_AUTH_DENIAL_REASON,
  OPERATOR_AUTH_SCHEMA_VERSION,
  OPERATOR_AUTH_UNAVAILABLE_REASON,
  OPERATOR_ROLE,
  classifyOperatorRoute,
} from '@yaagi/contracts/operator-auth';
import type { RecordOperatorAuthAuditEventInput } from '@yaagi/db';
import { createOperatorAuthService } from '../../src/security/operator-auth.ts';

const token = `opk_v1_${createHash('sha256').update('operator-auth-service').digest('hex').slice(0, 32)}`;
const tokenSha256 = createHash('sha256').update(token).digest('hex');
const stateRoute = classifyOperatorRoute('GET', '/state');
const tickRoute = classifyOperatorRoute('POST', '/control/tick');
const governorRoute = classifyOperatorRoute('POST', '/control/freeze-development');

assert.ok(stateRoute);
assert.ok(tickRoute);
assert.ok(governorRoute);

const writePrincipals = async (
  principals: Array<{
    principalRef: string;
    roles: string[];
    revokedAt?: string | null;
    credential?: {
      credentialRef?: string;
      tokenSha256?: string;
      expiresAt?: string | null;
      revokedAt?: string | null;
    };
  }>,
): Promise<{ root: string; filePath: string; cleanup: () => Promise<void> }> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-operator-auth-service-'));
  const filePath = path.join(root, 'principals.json');
  await writeFile(
    filePath,
    JSON.stringify(
      {
        schemaVersion: OPERATOR_AUTH_SCHEMA_VERSION,
        principals: principals.map((principal) => ({
          principalRef: principal.principalRef,
          roles: principal.roles,
          ...(principal.revokedAt !== undefined ? { revokedAt: principal.revokedAt } : {}),
          credentials: [
            {
              credentialRef: principal.credential?.credentialRef ?? 'credential:primary',
              tokenSha256: principal.credential?.tokenSha256 ?? tokenSha256,
              ...(principal.credential?.expiresAt !== undefined
                ? { expiresAt: principal.credential.expiresAt }
                : {}),
              ...(principal.credential?.revokedAt !== undefined
                ? { revokedAt: principal.credential.revokedAt }
                : {}),
            },
          ],
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  return { root, filePath, cleanup: () => rm(root, { recursive: true, force: true }) };
};

const requestWithToken = (inputToken = token): Request =>
  new Request('http://yaagi/state', {
    headers: {
      authorization: `Bearer ${inputToken}`,
    },
  });

const createAuditRecorder = (events: RecordOperatorAuthAuditEventInput[]) => {
  return (input: RecordOperatorAuthAuditEventInput) => {
    events.push(input);
    return Promise.resolve({
      accepted: true as const,
      event: {
        ...input,
        payloadJson: input.payloadJson ?? {},
      },
    });
  };
};

void test('AC-F0024-03 AC-F0024-11 admits valid credentials and writes bounded audit evidence', async () => {
  const fixture = await writePrincipals([
    {
      principalRef: 'operator:observer',
      roles: [OPERATOR_ROLE.OBSERVER],
    },
  ]);
  const events: RecordOperatorAuthAuditEventInput[] = [];

  try {
    const service = createOperatorAuthService({
      principalsFilePath: fixture.filePath,
      recordAuditEvent: createAuditRecorder(events),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 10,
      now: () => new Date('2026-04-23T10:00:00.000Z'),
      randomId: () => 'audit-id-1',
    });

    const result = await service.admit({
      request: requestWithToken(),
      route: stateRoute,
      requestId: 'http-request-1',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.equal(result.outcome, 'allow');
    if (result.outcome !== 'allow') return;
    assert.equal(result.evidence.principalRef, 'operator:observer');
    assert.equal(result.evidence.route, '/state');
    assert.equal(events.length, 1);
    assert.equal(events[0]?.decision, 'allow');
    assert.deepEqual(events[0]?.payloadJson, { credentialRef: 'credential:primary' });
    assert.equal(JSON.stringify(events).includes(token), false);
  } finally {
    await fixture.cleanup();
  }
});

void test('AC-F0024-04 denies known callers without the required route permission', async () => {
  const fixture = await writePrincipals([
    {
      principalRef: 'operator:observer',
      roles: [OPERATOR_ROLE.OBSERVER],
    },
  ]);
  const events: RecordOperatorAuthAuditEventInput[] = [];

  try {
    const service = createOperatorAuthService({
      principalsFilePath: fixture.filePath,
      recordAuditEvent: createAuditRecorder(events),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 10,
      now: () => new Date('2026-04-23T10:00:00.000Z'),
    });

    const result = await service.admit({
      request: requestWithToken(),
      route: tickRoute,
      requestId: 'http-request-2',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.deepEqual(result, {
      outcome: 'deny',
      reason: OPERATOR_AUTH_DENIAL_REASON.FORBIDDEN,
      requestId: 'http-request-2',
    });
    assert.equal(events[0]?.principalRef, 'operator:observer');
    assert.equal(events[0]?.denialReason, OPERATOR_AUTH_DENIAL_REASON.FORBIDDEN);
  } finally {
    await fixture.cleanup();
  }
});

void test('AC-F0024-12 returns bounded auth denials for malformed, expired and revoked credentials', async () => {
  const fixture = await writePrincipals([
    {
      principalRef: 'operator:operator',
      roles: [OPERATOR_ROLE.OPERATOR],
      credential: {
        expiresAt: '2026-04-23T09:59:59.000Z',
      },
    },
  ]);
  const events: RecordOperatorAuthAuditEventInput[] = [];

  try {
    const service = createOperatorAuthService({
      principalsFilePath: fixture.filePath,
      recordAuditEvent: createAuditRecorder(events),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 10,
      now: () => new Date('2026-04-23T10:00:00.000Z'),
    });

    const unsupported = await service.admit({
      request: requestWithToken('opk_v2_wrong-version'),
      route: tickRoute,
      requestId: 'http-request-unsupported',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });
    const expired = await service.admit({
      request: requestWithToken(),
      route: tickRoute,
      requestId: 'http-request-expired',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.equal(unsupported.outcome, 'deny');
    assert.equal(unsupported.reason, OPERATOR_AUTH_DENIAL_REASON.UNSUPPORTED_TOKEN_VERSION);
    assert.equal(expired.outcome, 'deny');
    assert.equal(expired.reason, OPERATOR_AUTH_DENIAL_REASON.EXPIRED);
    assert.equal(JSON.stringify(events).includes(token), false);
  } finally {
    await fixture.cleanup();
  }
});

void test('AC-F0024-13 rate limits by stable caller dimensions before route handlers can run', async () => {
  const fixture = await writePrincipals([
    {
      principalRef: 'operator:governor',
      roles: [OPERATOR_ROLE.GOVERNOR_OPERATOR],
    },
  ]);
  const events: RecordOperatorAuthAuditEventInput[] = [];

  try {
    const service = createOperatorAuthService({
      principalsFilePath: fixture.filePath,
      recordAuditEvent: createAuditRecorder(events),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 1,
      now: () => new Date('2026-04-23T10:00:00.000Z'),
    });

    const first = await service.admit({
      request: requestWithToken(),
      route: governorRoute,
      requestId: 'http-request-rate-1',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });
    const second = await service.admit({
      request: requestWithToken(),
      route: governorRoute,
      requestId: 'http-request-rate-2',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });
    const third = await service.admit({
      request: requestWithToken(),
      route: governorRoute,
      requestId: 'http-request-rate-3',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.equal(first.outcome, 'allow');
    assert.equal(second.outcome, 'deny');
    assert.equal(second.reason, OPERATOR_AUTH_DENIAL_REASON.RATE_LIMITED);
    assert.equal(third.outcome, 'deny');
    assert.equal(third.reason, OPERATOR_AUTH_DENIAL_REASON.RATE_LIMITED);
    assert.deepEqual(
      events.map((event) => event.decision),
      ['allow', 'deny', 'deny'],
    );
  } finally {
    await fixture.cleanup();
  }
});

void test('AC-F0024-13 keeps invalid-token throttling separate from valid caller buckets', async () => {
  const fixture = await writePrincipals([
    {
      principalRef: 'operator:observer',
      roles: [OPERATOR_ROLE.OBSERVER],
    },
  ]);
  const events: RecordOperatorAuthAuditEventInput[] = [];

  try {
    const service = createOperatorAuthService({
      principalsFilePath: fixture.filePath,
      recordAuditEvent: createAuditRecorder(events),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 1,
      now: () => new Date('2026-04-23T10:00:00.000Z'),
    });

    const invalid = await service.admit({
      request: requestWithToken('opk_v1_invalid-token-before-valid'),
      route: stateRoute,
      requestId: 'http-request-invalid-before-valid',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });
    const valid = await service.admit({
      request: requestWithToken(),
      route: stateRoute,
      requestId: 'http-request-valid-after-invalid',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });
    const repeatedValid = await service.admit({
      request: requestWithToken(),
      route: stateRoute,
      requestId: 'http-request-valid-repeat',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.equal(invalid.outcome, 'deny');
    assert.equal(invalid.reason, OPERATOR_AUTH_DENIAL_REASON.UNAUTHENTICATED);
    assert.equal(valid.outcome, 'allow');
    assert.equal(repeatedValid.outcome, 'deny');
    assert.equal(repeatedValid.reason, OPERATOR_AUTH_DENIAL_REASON.RATE_LIMITED);
  } finally {
    await fixture.cleanup();
  }
});

void test('AC-F0024-13 rate limits unique invalid bearer tokens on a stable pre-auth route bucket', async () => {
  const fixture = await writePrincipals([
    {
      principalRef: 'operator:observer',
      roles: [OPERATOR_ROLE.OBSERVER],
    },
  ]);
  const events: RecordOperatorAuthAuditEventInput[] = [];

  try {
    const service = createOperatorAuthService({
      principalsFilePath: fixture.filePath,
      recordAuditEvent: createAuditRecorder(events),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 1,
      now: () => new Date('2026-04-23T10:00:00.000Z'),
    });

    const first = await service.admit({
      request: requestWithToken('opk_v1_invalid-token-one'),
      route: stateRoute,
      requestId: 'http-request-invalid-rate-1',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });
    const second = await service.admit({
      request: requestWithToken('opk_v1_invalid-token-two'),
      route: stateRoute,
      requestId: 'http-request-invalid-rate-2',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.equal(first.outcome, 'deny');
    assert.equal(first.reason, OPERATOR_AUTH_DENIAL_REASON.UNAUTHENTICATED);
    assert.equal(second.outcome, 'deny');
    assert.equal(second.reason, OPERATOR_AUTH_DENIAL_REASON.RATE_LIMITED);
    assert.equal(JSON.stringify(events).includes('invalid-token'), false);
  } finally {
    await fixture.cleanup();
  }
});

void test('AC-F0024-09 AC-F0024-11 bounds request, session and evidence refs before audit', async () => {
  const fixture = await writePrincipals([
    {
      principalRef: `operator:${'p'.repeat(191)}`,
      roles: [OPERATOR_ROLE.OBSERVER],
      credential: {
        credentialRef: `credential:${'c'.repeat(189)}`,
      },
    },
  ]);
  const events: RecordOperatorAuthAuditEventInput[] = [];

  try {
    const service = createOperatorAuthService({
      principalsFilePath: fixture.filePath,
      recordAuditEvent: createAuditRecorder(events),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 10,
      now: () => new Date('2026-04-23T10:00:00.000Z'),
      randomId: () => 'audit-id-bounded',
    });

    const result = await service.admit({
      request: requestWithToken(),
      route: stateRoute,
      requestId: `http-request-${'x'.repeat(400)}`,
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.equal(result.outcome, 'allow');
    if (result.outcome !== 'allow') return;

    assert.equal(result.evidence.requestId.length <= 200, true);
    assert.equal(result.evidence.sessionRef.length <= 200, true);
    assert.equal(result.evidence.evidenceRef.length <= 200, true);
    assert.equal(events[0]?.requestId, result.evidence.requestId);
    assert.equal(events[0]?.sessionRef, result.evidence.sessionRef);
    assert.equal(events[0]?.evidenceRef, result.evidence.evidenceRef);
    assert.equal(events[0]?.auditEventId.length <= 200, true);
  } finally {
    await fixture.cleanup();
  }
});

void test('AC-F0024-16 fails closed when the principal file contains duplicate credential hashes', async () => {
  const fixture = await writePrincipals([
    {
      principalRef: 'operator:observer',
      roles: [OPERATOR_ROLE.OBSERVER],
    },
    {
      principalRef: 'operator:operator',
      roles: [OPERATOR_ROLE.OPERATOR],
    },
  ]);
  const events: RecordOperatorAuthAuditEventInput[] = [];

  try {
    const service = createOperatorAuthService({
      principalsFilePath: fixture.filePath,
      recordAuditEvent: createAuditRecorder(events),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 10,
      now: () => new Date('2026-04-23T10:00:00.000Z'),
    });

    const result = await service.admit({
      request: requestWithToken(),
      route: stateRoute,
      requestId: 'http-request-duplicate-token',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.deepEqual(result, {
      outcome: 'unavailable',
      reason: OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_CONFIG_INVALID,
      requestId: 'http-request-duplicate-token',
    });
  } finally {
    await fixture.cleanup();
  }
});

void test('AC-F0024-16 fails closed when auth config or audit recording is unavailable', async () => {
  const missingConfigEvents: RecordOperatorAuthAuditEventInput[] = [];
  const missingConfigService = createOperatorAuthService({
    principalsFilePath: null,
    recordAuditEvent: createAuditRecorder(missingConfigEvents),
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 10,
  });

  const missingConfig = await missingConfigService.admit({
    request: requestWithToken(),
    route: stateRoute,
    requestId: 'http-request-missing-config',
    requestedAt: '2026-04-23T10:00:00.000Z',
  });

  assert.deepEqual(missingConfig, {
    outcome: 'unavailable',
    reason: OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_CONFIG_MISSING,
    requestId: 'http-request-missing-config',
  });

  const invalidConfigFixture = await writePrincipals([
    {
      principalRef: 'operator:observer',
      roles: [OPERATOR_ROLE.OBSERVER],
    },
  ]);

  try {
    await writeFile(invalidConfigFixture.filePath, '{', 'utf8');
    const invalidConfigService = createOperatorAuthService({
      principalsFilePath: invalidConfigFixture.filePath,
      recordAuditEvent: createAuditRecorder([]),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 10,
    });

    const invalidConfig = await invalidConfigService.admit({
      request: requestWithToken(),
      route: stateRoute,
      requestId: 'http-request-invalid-config',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.deepEqual(invalidConfig, {
      outcome: 'unavailable',
      reason: OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_CONFIG_INVALID,
      requestId: 'http-request-invalid-config',
    });
  } finally {
    await invalidConfigFixture.cleanup();
  }

  const fixture = await writePrincipals([
    {
      principalRef: 'operator:observer',
      roles: [OPERATOR_ROLE.OBSERVER],
    },
  ]);

  try {
    const auditUnavailableService = createOperatorAuthService({
      principalsFilePath: fixture.filePath,
      recordAuditEvent: () => Promise.reject(new Error('audit store unavailable')),
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 10,
    });

    const auditUnavailable = await auditUnavailableService.admit({
      request: requestWithToken(),
      route: stateRoute,
      requestId: 'http-request-audit-unavailable',
      requestedAt: '2026-04-23T10:00:00.000Z',
    });

    assert.deepEqual(auditUnavailable, {
      outcome: 'unavailable',
      reason: OPERATOR_AUTH_UNAVAILABLE_REASON.AUTH_STORE_UNAVAILABLE,
      requestId: 'http-request-audit-unavailable',
    });
  } finally {
    await fixture.cleanup();
  }
});
