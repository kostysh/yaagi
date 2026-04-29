import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OPERATOR_AUTH_DECISION,
  OPERATOR_AUTH_DENIAL_REASON,
  OPERATOR_ROUTE_CLASS,
  OPERATOR_RISK_CLASS,
  type OperatorAuthAuditEventRow,
} from '@yaagi/contracts/operator-auth';
import { createOperatorAuthStore, type OperatorAuthDbExecutor } from '../src/operator-auth.ts';

type Harness = {
  db: OperatorAuthDbExecutor;
  events: OperatorAuthAuditEventRow[];
};

const parseJson = <T>(value: unknown): T => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
};

const createHarness = (): Harness => {
  const events: OperatorAuthAuditEventRow[] = [];

  const query = ((sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('operator auth harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();
    if (sql.startsWith('insert into polyphony_runtime.operator_auth_audit_events')) {
      const row: OperatorAuthAuditEventRow = {
        auditEventId: String(params[0]),
        requestId: String(params[1]),
        principalRef: typeof params[2] === 'string' ? String(params[2]) : null,
        sessionRef: typeof params[3] === 'string' ? String(params[3]) : null,
        method: String(params[4]),
        route: String(params[5]),
        routeClass: params[6] as OperatorAuthAuditEventRow['routeClass'],
        riskClass: params[7] as OperatorAuthAuditEventRow['riskClass'],
        decision: params[8] as OperatorAuthAuditEventRow['decision'],
        denialReason:
          typeof params[9] === 'string'
            ? (String(params[9]) as OperatorAuthAuditEventRow['denialReason'])
            : null,
        evidenceRef: typeof params[10] === 'string' ? String(params[10]) : null,
        payloadJson: parseJson<Record<string, unknown>>(params[11]),
        createdAt: new Date(String(params[12])).toISOString(),
      };
      events.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('select 1 from polyphony_runtime.operator_auth_audit_events')) {
      const [evidenceRef, decision] = params;
      const matched = events.some(
        (event) => event.evidenceRef === evidenceRef && event.decision === decision,
      );
      return Promise.resolve({ rows: matched ? [{ one: 1 }] : [] });
    }

    throw new Error(`unsupported sql in operator auth harness: ${sqlText}`);
  }) as OperatorAuthDbExecutor['query'];

  return { db: { query }, events };
};

void test('AC-F0024-11 records bounded operator auth audit events without plaintext credentials', async () => {
  const harness = createHarness();
  const store = createOperatorAuthStore(harness.db);

  const result = await store.recordAuthAuditEvent({
    auditEventId: 'operator-auth-audit:1',
    requestId: 'http-request-1',
    principalRef: 'operator:observer',
    sessionRef: 'operator-session:observer:primary',
    method: 'GET',
    route: '/state',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
    decision: OPERATOR_AUTH_DECISION.ALLOW,
    denialReason: null,
    evidenceRef: 'operator-auth-evidence:http-request-1',
    payloadJson: { credentialRef: 'credential:observer:primary' },
    createdAt: '2026-04-23T10:00:00.000Z',
  });

  assert.equal(result.accepted, true);
  assert.equal(harness.events.length, 1);
  assert.equal(result.event.principalRef, 'operator:observer');
  assert.equal(result.event.decision, OPERATOR_AUTH_DECISION.ALLOW);
  assert.deepEqual(result.event.payloadJson, { credentialRef: 'credential:observer:primary' });
  assert.equal('token' in result.event.payloadJson, false);
  assert.equal('bearer' in result.event.payloadJson, false);
});

void test('AC-F0024-11 records denied decisions with null principal and bounded reason', async () => {
  const harness = createHarness();
  const store = createOperatorAuthStore(harness.db);

  const result = await store.recordAuthAuditEvent({
    auditEventId: 'operator-auth-audit:2',
    requestId: 'http-request-2',
    principalRef: null,
    sessionRef: null,
    method: 'POST',
    route: '/control/tick',
    routeClass: OPERATOR_ROUTE_CLASS.TICK_CONTROL,
    riskClass: OPERATOR_RISK_CLASS.CONTROL,
    decision: OPERATOR_AUTH_DECISION.DENY,
    denialReason: OPERATOR_AUTH_DENIAL_REASON.UNAUTHENTICATED,
    evidenceRef: null,
    createdAt: '2026-04-23T10:01:00.000Z',
  });

  assert.equal(result.event.principalRef, null);
  assert.equal(result.event.sessionRef, null);
  assert.equal(result.event.denialReason, OPERATOR_AUTH_DENIAL_REASON.UNAUTHENTICATED);
  assert.deepEqual(result.event.payloadJson, {});
});

void test('AC-F0028-13 exposes bounded allowed-auth evidence lookup for support', async () => {
  const harness = createHarness();
  const store = createOperatorAuthStore(harness.db);

  await store.recordAuthAuditEvent({
    auditEventId: 'operator-auth-audit:allowed-evidence',
    requestId: 'http-request-allowed-evidence',
    principalRef: 'operator:observer',
    sessionRef: 'operator-session:observer:primary',
    method: 'GET',
    route: '/state',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
    decision: OPERATOR_AUTH_DECISION.ALLOW,
    denialReason: null,
    evidenceRef: 'operator-auth-evidence:allowed',
    createdAt: '2026-04-23T10:02:00.000Z',
  });
  await store.recordAuthAuditEvent({
    auditEventId: 'operator-auth-audit:denied-evidence',
    requestId: 'http-request-denied-evidence',
    principalRef: null,
    sessionRef: null,
    method: 'GET',
    route: '/state',
    routeClass: OPERATOR_ROUTE_CLASS.READ_INTROSPECTION,
    riskClass: OPERATOR_RISK_CLASS.READ_ONLY,
    decision: OPERATOR_AUTH_DECISION.DENY,
    denialReason: OPERATOR_AUTH_DENIAL_REASON.UNAUTHENTICATED,
    evidenceRef: 'operator-auth-evidence:denied',
    createdAt: '2026-04-23T10:03:00.000Z',
  });

  assert.equal(await store.hasAllowedAuthEvidence('operator-auth-evidence:allowed'), true);
  assert.equal(await store.hasAllowedAuthEvidence('operator-auth-evidence:denied'), false);
  assert.equal(await store.hasAllowedAuthEvidence('operator-auth-evidence:missing'), false);
});

void test('AC-F0026 protected release routes can persist operator auth audit events', async () => {
  const harness = createHarness();
  const store = createOperatorAuthStore(harness.db);

  const result = await store.recordAuthAuditEvent({
    auditEventId: 'operator-auth-audit:release-control',
    requestId: 'http-request-release-control',
    principalRef: 'operator:release',
    sessionRef: 'operator-session:release:primary',
    method: 'POST',
    route: '/control/releases',
    routeClass: OPERATOR_ROUTE_CLASS.RELEASE_CONTROL,
    riskClass: OPERATOR_RISK_CLASS.CONTROL,
    decision: OPERATOR_AUTH_DECISION.ALLOW,
    denialReason: null,
    evidenceRef: 'operator-auth-evidence:http-request-release-control',
    payloadJson: { credentialRef: 'credential:release:primary' },
    createdAt: '2026-04-24T20:00:00.000Z',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.event.routeClass, OPERATOR_ROUTE_CLASS.RELEASE_CONTROL);
  assert.equal(result.event.route, '/control/releases');
  assert.equal(result.event.principalRef, 'operator:release');
});

void test('AC-F0026 migration allows release_control in operator auth audit route-class constraint', async () => {
  const migration = await readFile(
    'infra/migrations/026_operator_auth_release_control_route_class.sql',
    'utf8',
  );

  assert.match(migration, /DROP CONSTRAINT IF EXISTS operator_auth_audit_events_route_class_check/);
  assert.match(migration, /ADD CONSTRAINT operator_auth_audit_events_route_class_check CHECK/);
  assert.match(migration, /'release_control'/);
});
