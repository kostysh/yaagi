import test from 'node:test';
import assert from 'node:assert/strict';
import type { SubjectStateSnapshot } from '@yaagi/db';
import {
  createOperatorAuthHeaders,
  createPlatformTestRuntime,
} from '../../testing/platform-test-fixture.ts';

const snapshot: SubjectStateSnapshot = {
  subjectStateSchemaVersion: '2026-03-25',
  agentState: {
    agentId: 'polyphony-core',
    mode: 'normal',
    currentTickId: null,
    currentModelProfileId: 'reflex.fast@baseline',
    lastStableSnapshotId: 'snapshot-rbac',
    psmJson: {},
    resourcePostureJson: {},
  },
  goals: [],
  beliefs: [],
  entities: [],
  relationships: [],
};

void test('AC-F0024-03 protects operator routes while leaving platform health public', async () => {
  let stateCalls = 0;
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        health: () =>
          Promise.resolve({
            adapters: [],
            backlog: {
              queued: 0,
              claimed: 0,
              consumed: 0,
              dropped: 0,
            },
          }),
        getSubjectStateSnapshot: () => {
          stateCalls += 1;
          return Promise.resolve(snapshot);
        },
      }),
    },
  });

  try {
    const health = await runtime.fetch(new Request('http://yaagi/health'));
    const unauthenticatedState = await runtime.fetch(
      new Request('http://yaagi/state', {
        headers: {
          'x-request-id': 'http-request-unauth-state',
        },
      }),
    );

    assert.equal(health.status, 200);
    assert.equal(unauthenticatedState.status, 401);
    assert.deepEqual(await unauthenticatedState.json(), {
      accepted: false,
      error: 'operator_auth_required',
      requestId: 'http-request-unauth-state',
    });
  } finally {
    assert.equal(stateCalls, 0);
    await cleanup();
  }
});

void test('AC-F0024-04 denies known callers without route permission before downstream owner invocation', async () => {
  let tickCalls = 0;
  let freezeCalls = 0;
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        requestTick: () => {
          tickCalls += 1;
          return Promise.resolve({ accepted: true });
        },
        freezeDevelopment: () => {
          freezeCalls += 1;
          return Promise.resolve({
            accepted: true,
            requestId: 'should-not-run',
            freezeId: 'should-not-run',
            state: 'frozen',
            triggerKind: 'operator',
            decisionOrigin: 'operator',
            deduplicated: false,
            createdAt: '2026-04-23T10:00:00.000Z',
          });
        },
      }),
    },
  });

  try {
    const observerTick = await runtime.fetch(
      new Request('http://yaagi/control/tick', {
        method: 'POST',
        headers: createOperatorAuthHeaders('observer', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'operator-request-rbac',
          kind: 'reactive',
        }),
      }),
    );
    const operatorFreeze = await runtime.fetch(
      new Request('http://yaagi/control/freeze-development', {
        method: 'POST',
        headers: createOperatorAuthHeaders('operator', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'operator-freeze-rbac',
          reason: 'operator role must not freeze development',
        }),
      }),
    );

    assert.equal(observerTick.status, 403);
    assert.equal(operatorFreeze.status, 403);
    assert.equal(tickCalls, 0);
    assert.equal(freezeCalls, 0);
  } finally {
    await cleanup();
  }
});

void test('AC-F0024-16 fails closed before route handlers when audit recording is unavailable', async () => {
  let stateCalls = 0;
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        recordOperatorAuthAuditEvent: () => Promise.reject(new Error('audit unavailable')),
        getSubjectStateSnapshot: () => {
          stateCalls += 1;
          return Promise.resolve(snapshot);
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/state', {
        headers: createOperatorAuthHeaders('operator', {
          'x-request-id': 'http-request-audit-unavailable',
        }),
      }),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      accepted: false,
      error: 'operator_auth_unavailable',
      requestId: 'http-request-audit-unavailable',
    });
    assert.equal(stateCalls, 0);
  } finally {
    await cleanup();
  }
});
