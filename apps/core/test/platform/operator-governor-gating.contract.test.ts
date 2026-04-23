import test from 'node:test';
import assert from 'node:assert/strict';
import { OPERATOR_GOVERNOR_CONTROL_BODY_MAX_BYTES } from '@yaagi/contracts/operator-api';
import {
  createOperatorAuthHeaders,
  createPlatformTestRuntime,
} from '../../testing/platform-test-fixture.ts';

// Coverage refs: AC-F0024-08 AC-F0024-09 AC-F0024-17

const expectedUnavailableResponse = {
  available: false,
  action: 'freeze-development',
  owner: 'F-0016',
  reason: 'downstream_owner_unavailable',
} as const;

void test('AC-F0024-08 admits governor operators before forwarding freeze-development to the owner gate', async () => {
  let callCount = 0;
  const forwardedEvidenceRefs: string[][] = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        freezeDevelopment: (input) => {
          callCount += 1;
          forwardedEvidenceRefs.push(input.evidenceRefs);
          return Promise.resolve({
            accepted: true,
            requestId: input.requestId,
            freezeId: 'development-freeze:1',
            state: 'frozen',
            triggerKind: 'operator',
            decisionOrigin: 'operator',
            deduplicated: false,
            createdAt: '2026-04-15T12:00:00.000Z',
          });
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/freeze-development', {
        method: 'POST',
        headers: createOperatorAuthHeaders('governor', {
          'content-type': 'application/json',
          'x-request-id': 'http-request-freeze-1',
        }),
        body: JSON.stringify({
          requestId: 'operator-freeze-1',
          reason: 'manual stop before risky change',
          evidenceRefs: ['operator:manual-control'],
        }),
      }),
    );

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {
      accepted: true,
      requestId: 'operator-freeze-1',
      freezeId: 'development-freeze:1',
      state: 'frozen',
      triggerKind: 'operator',
      decisionOrigin: 'operator',
      deduplicated: false,
      createdAt: '2026-04-15T12:00:00.000Z',
    });
    assert.equal(callCount, 1);
    assert.equal(forwardedEvidenceRefs.length, 1);
    assert.equal(forwardedEvidenceRefs[0]?.[0], 'operator:manual-control');
    assert.match(forwardedEvidenceRefs[0]?.[1] ?? '', /^operator-auth-evidence:/);
    assert.equal((forwardedEvidenceRefs[0]?.[1] ?? '').length <= 200, true);
  } finally {
    await cleanup();
  }
});

void test('AC-F0024-08 rejects invalid freeze payloads after caller admission without owner calls', async () => {
  let callCount = 0;
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        freezeDevelopment: () => {
          callCount += 1;
          return Promise.resolve({
            accepted: false,
            requestId: 'should-not-run',
            reason: 'persistence_unavailable',
          });
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/freeze-development', {
        method: 'POST',
        headers: createOperatorAuthHeaders('governor', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          reason: 'missing request id',
        }),
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(callCount, 0);
  } finally {
    await cleanup();
  }
});

void test('AC-F0024-08 rejects oversized freeze payloads before owner calls', async () => {
  let callCount = 0;
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        freezeDevelopment: () => {
          callCount += 1;
          return Promise.resolve({
            accepted: false,
            requestId: 'should-not-run',
            reason: 'persistence_unavailable',
          });
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/freeze-development', {
        method: 'POST',
        headers: createOperatorAuthHeaders('governor', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'operator-freeze-oversized',
          reason: 'manual stop before risky change',
          evidenceRefs: [],
          oversized: 'x'.repeat(OPERATOR_GOVERNOR_CONTROL_BODY_MAX_BYTES),
        }),
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(callCount, 0);
  } finally {
    await cleanup();
  }
});

void test('AC-F0024-08 fails closed on freeze-development when the governor seam is absent', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        requestTick: () => Promise.resolve({ accepted: true }),
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/freeze-development', {
        method: 'POST',
        headers: createOperatorAuthHeaders('governor', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'operator-freeze-1',
          reason: 'manual stop before risky change',
        }),
      }),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), expectedUnavailableResponse);
  } finally {
    await cleanup();
  }
});
