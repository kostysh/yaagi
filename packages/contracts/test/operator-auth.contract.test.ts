import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERATOR_AUTH_DECISION,
  OPERATOR_AUTH_SCHEMA_VERSION,
  OPERATOR_ROLE,
  OPERATOR_ROUTE_CLASS,
  OPERATOR_RISK_CLASS,
  OPERATOR_TOKEN_VERSION,
  classifyOperatorRoute,
  isOperatorRouteClassAllowedForRoles,
  operatorAuthAuditEventRowSchema,
  operatorPrincipalFileSchema,
  operatorTrustedIngressEvidenceSchema,
} from '@yaagi/contracts/operator-auth';

const tokenSha256 = 'a'.repeat(64);

void test('AC-F0024-01 AC-F0024-05 classifies delivered operator routes without creating a second surface', () => {
  assert.deepEqual(classifyOperatorRoute('GET', 'http://yaagi/state?goalLimit=3'), {
    method: 'GET',
    path: '/state',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
  });
  assert.deepEqual(classifyOperatorRoute('GET', '/reports'), {
    method: 'GET',
    path: '/reports',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
  });
  assert.deepEqual(classifyOperatorRoute('GET', '/support/runbooks'), {
    method: 'GET',
    path: '/support/runbooks',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
  });
  assert.deepEqual(classifyOperatorRoute('PATCH', '/support/incidents/support-incident:1'), {
    method: 'PATCH',
    path: '/support/incidents/:id',
    routeClass: OPERATOR_ROUTE_CLASS.SUPPORT_OPERATION,
    riskClass: OPERATOR_RISK_CLASS.CONTROL,
  });
  assert.deepEqual(classifyOperatorRoute('POST', '/control/tick'), {
    method: 'POST',
    path: '/control/tick',
    routeClass: OPERATOR_ROUTE_CLASS.TICK_CONTROL,
    riskClass: OPERATOR_RISK_CLASS.CONTROL,
  });
  assert.deepEqual(classifyOperatorRoute('POST', '/control/freeze-development'), {
    method: 'POST',
    path: '/control/freeze-development',
    routeClass: OPERATOR_ROUTE_CLASS.GOVERNOR_SUBMISSION,
    riskClass: OPERATOR_RISK_CLASS.HIGH_RISK,
  });
  assert.deepEqual(classifyOperatorRoute('POST', '/control/releases'), {
    method: 'POST',
    path: '/control/releases',
    routeClass: OPERATOR_ROUTE_CLASS.RELEASE_CONTROL,
    riskClass: OPERATOR_RISK_CLASS.HIGH_RISK,
  });
  assert.deepEqual(classifyOperatorRoute('POST', '/control/release-deploy-attempts'), {
    method: 'POST',
    path: '/control/release-deploy-attempts',
    routeClass: OPERATOR_ROUTE_CLASS.RELEASE_CONTROL,
    riskClass: OPERATOR_RISK_CLASS.HIGH_RISK,
  });
  assert.equal(classifyOperatorRoute('GET', '/operator-shadow/state'), null);
});

void test('AC-F0024-04 AC-F0024-06 keeps default role permissions explicit and deny-by-default', () => {
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.OBSERVER],
      OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    ),
    true,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.OBSERVER],
      OPERATOR_ROUTE_CLASS.TICK_CONTROL,
    ),
    false,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.OPERATOR],
      OPERATOR_ROUTE_CLASS.TICK_CONTROL,
    ),
    true,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.OPERATOR],
      OPERATOR_ROUTE_CLASS.GOVERNOR_SUBMISSION,
    ),
    false,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.GOVERNOR_OPERATOR],
      OPERATOR_ROUTE_CLASS.GOVERNOR_SUBMISSION,
    ),
    true,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.GOVERNOR_OPERATOR],
      OPERATOR_ROUTE_CLASS.RELEASE_CONTROL,
    ),
    false,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.RELEASE_OPERATOR],
      OPERATOR_ROUTE_CLASS.RELEASE_CONTROL,
    ),
    true,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.OPERATOR],
      OPERATOR_ROUTE_CLASS.SUPPORT_OPERATION,
    ),
    false,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.SUPPORT_OPERATOR],
      OPERATOR_ROUTE_CLASS.SUPPORT_OPERATION,
    ),
    true,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.SUPPORT_OPERATOR],
      OPERATOR_ROUTE_CLASS.RELEASE_CONTROL,
    ),
    false,
  );
  assert.equal(
    isOperatorRouteClassAllowedForRoles(
      [OPERATOR_ROLE.ADMIN],
      OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    ),
    false,
  );
});

void test('AC-F0024-09 AC-F0024-11 validates trusted ingress and audit evidence without secret fields', () => {
  const evidence = operatorTrustedIngressEvidenceSchema.parse({
    evidenceRef: 'operator-auth-evidence:req-1',
    principalRef: 'operator:observer',
    sessionRef: 'operator-session:observer:primary',
    requestId: 'http-request-1',
    method: 'GET',
    route: '/state',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
    admittedAt: '2026-04-23T10:00:00.000Z',
  });

  const auditEvent = operatorAuthAuditEventRowSchema.parse({
    auditEventId: 'operator-auth-audit:req-1',
    requestId: evidence.requestId,
    principalRef: evidence.principalRef,
    sessionRef: evidence.sessionRef,
    method: evidence.method,
    route: evidence.route,
    routeClass: evidence.routeClass,
    riskClass: evidence.riskClass,
    decision: OPERATOR_AUTH_DECISION.ALLOW,
    denialReason: null,
    evidenceRef: evidence.evidenceRef,
    payloadJson: {},
    createdAt: evidence.admittedAt,
  });

  assert.equal(auditEvent.evidenceRef, evidence.evidenceRef);
  assert.equal('token' in auditEvent, false);
  assert.equal('credential' in auditEvent, false);
});

void test('AC-F0024-12 AC-F0024-16 validates versioned principal files with hashed opaque credentials only', () => {
  const parsed = operatorPrincipalFileSchema.parse({
    schemaVersion: OPERATOR_AUTH_SCHEMA_VERSION,
    principals: [
      {
        principalRef: 'operator:observer',
        roles: [OPERATOR_ROLE.OBSERVER],
        credentials: [
          {
            credentialRef: 'credential:observer:primary',
            tokenVersion: OPERATOR_TOKEN_VERSION,
            tokenSha256,
          },
        ],
      },
    ],
  });

  assert.equal(parsed.principals[0]?.credentials[0]?.tokenSha256, tokenSha256);
  assert.throws(() =>
    operatorPrincipalFileSchema.parse({
      schemaVersion: OPERATOR_AUTH_SCHEMA_VERSION,
      principals: [
        {
          principalRef: 'operator:observer',
          roles: [OPERATOR_ROLE.OBSERVER],
          credentials: [{ credentialRef: 'bad', tokenSha256: 'plaintext-token' }],
        },
      ],
    }),
  );

  assert.throws(() =>
    operatorPrincipalFileSchema.parse({
      schemaVersion: OPERATOR_AUTH_SCHEMA_VERSION,
      principals: [
        {
          principalRef: 'operator:observer',
          roles: [OPERATOR_ROLE.OBSERVER],
          credentials: [{ credentialRef: 'credential:observer:primary', tokenSha256 }],
        },
        {
          principalRef: 'operator:operator',
          roles: [OPERATOR_ROLE.OPERATOR],
          credentials: [{ credentialRef: 'credential:operator:primary', tokenSha256 }],
        },
      ],
    }),
  );

  assert.throws(() =>
    operatorPrincipalFileSchema.parse({
      schemaVersion: OPERATOR_AUTH_SCHEMA_VERSION,
      principals: [
        {
          principalRef: 'operator:observer',
          roles: [OPERATOR_ROLE.OBSERVER],
          credentials: [{ credentialRef: 'credential:shared', tokenSha256 }],
        },
        {
          principalRef: 'operator:operator',
          roles: [OPERATOR_ROLE.OPERATOR],
          credentials: [{ credentialRef: 'credential:shared', tokenSha256: 'b'.repeat(64) }],
        },
      ],
    }),
  );
});
