import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_CLOSURE_STATUS,
  SUPPORT_INCIDENT_CLASS,
  SUPPORT_SEVERITY,
} from '@yaagi/contracts/support';
import type { SupportIncidentRow } from '@yaagi/db';
import {
  createOperatorAuthHeaders,
  createPlatformTestRuntime,
} from '../../testing/platform-test-fixture.ts';
import { DEFAULT_SUPPORT_RUNBOOKS } from '../../src/support/support-evidence.ts';

const now = '2026-04-29T12:00:00.000Z';

void test('AC-F0028-05 exposes support runbooks inside the protected F-0013 operator namespace', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        listSupportRunbooks: () => Promise.resolve([...DEFAULT_SUPPORT_RUNBOOKS]),
      }),
    },
  });

  try {
    const unauthenticated = await runtime.fetch(new Request('http://yaagi/support/runbooks'));
    const authenticated = await runtime.fetch(
      new Request('http://yaagi/support/runbooks', {
        headers: createOperatorAuthHeaders('observer'),
      }),
    );

    assert.equal(unauthenticated.status, 401);
    assert.equal(authenticated.status, 200);
    const body = (await authenticated.json()) as { items: unknown[] };
    assert.equal(body.items.length, 7);
  } finally {
    await cleanup();
  }
});

void test('AC-F0028-05 AC-F0028-08 admits support incident writes only after F-0024 support RBAC', async () => {
  const forwardedInputs: unknown[] = [];
  const incident = (requestId: string): SupportIncidentRow => ({
    supportIncidentId: 'support-incident:operator-route',
    requestId,
    normalizedRequestHash: 'hash',
    incidentClass: SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['operator-route:/health'],
    reportRunRefs: [],
    releaseRefs: [],
    operatorEvidenceRefs: ['operator-auth-evidence:route'],
    actionRefs: [],
    escalationRefs: [],
    closureCriteria: [],
    operatorNotes: [],
    closureStatus: SUPPORT_CLOSURE_STATUS.OPEN,
    closureReadinessStatus: 'ready',
    closureReadinessReasons: [],
    residualRisk: null,
    nextOwnerRef: null,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  });
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        openSupportIncident: (input) => {
          forwardedInputs.push(input);
          return Promise.resolve({
            accepted: true as const,
            deduplicated: false,
            incident: incident(input.requestId),
            closureReadiness: { status: 'ready' as const, reasons: [] },
          });
        },
      }),
    },
  });

  try {
    const operatorDenied = await runtime.fetch(
      new Request('http://yaagi/support/incidents', {
        method: 'POST',
        headers: createOperatorAuthHeaders('operator', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'support-request-denied',
          incidentClass: SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY,
          severity: SUPPORT_SEVERITY.WARNING,
          sourceRefs: ['operator-route:/health'],
        }),
      }),
    );
    const supportAccepted = await runtime.fetch(
      new Request('http://yaagi/support/incidents', {
        method: 'POST',
        headers: createOperatorAuthHeaders('support', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'support-request-accepted',
          incidentClass: SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY,
          severity: SUPPORT_SEVERITY.WARNING,
          sourceRefs: ['operator-route:/health'],
          note: 'bounded operator note',
        }),
      }),
    );

    assert.equal(operatorDenied.status, 403);
    assert.equal(supportAccepted.status, 202);
    assert.equal(forwardedInputs.length, 1);
    assert.deepEqual(
      {
        ...(forwardedInputs[0] as {
          requestId: string;
          operatorPrincipalRef: string;
          operatorEvidenceRef: string;
        }),
        operatorEvidenceRef: '<bounded-evidence-ref>',
      },
      {
        requestId: 'support-request-accepted',
        incidentClass: SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY,
        severity: SUPPORT_SEVERITY.WARNING,
        sourceRefs: ['operator-route:/health'],
        reportRunRefs: [],
        releaseRefs: [],
        operatorEvidenceRefs: [],
        actionRefs: [],
        escalationRefs: [],
        closureCriteria: [],
        note: 'bounded operator note',
        operatorPrincipalRef: 'operator:test-support',
        operatorSessionRef: (forwardedInputs[0] as { operatorSessionRef: string })
          .operatorSessionRef,
        operatorEvidenceRef: '<bounded-evidence-ref>',
      },
    );
    assert.match(
      (forwardedInputs[0] as { operatorEvidenceRef: string }).operatorEvidenceRef,
      /^operator-auth-evidence:/,
    );
  } finally {
    await cleanup();
  }
});
