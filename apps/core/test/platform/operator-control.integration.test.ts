import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

void test('AC-F0013-05 forwards operator tick control through the canonical runtime gate with preserved provenance', async () => {
  const forwardedInputs: Array<{
    requestId: string;
    kind: string;
    trigger: string;
    requestedAt: string;
    payload: Record<string, unknown>;
  }> = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        requestTick: (input) => {
          forwardedInputs.push(input);
          return Promise.resolve({ accepted: true });
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/tick', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requestId: 'operator-request-1',
          kind: 'reactive',
          note: 'manual intervention',
          payload: {
            source: 'operator',
          },
        }),
      }),
    );

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {
      accepted: true,
      requestId: 'operator-request-1',
      requestedKind: 'reactive',
      routedTrigger: 'system',
    });
    assert.equal(forwardedInputs.length, 1);
    assert.equal(forwardedInputs[0]?.requestId, 'operator-request-1');
    assert.equal(forwardedInputs[0]?.kind, 'reactive');
    assert.equal(forwardedInputs[0]?.trigger, 'system');
    assert.match(forwardedInputs[0]?.requestedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(forwardedInputs[0]?.payload, {
      source: 'operator',
      operatorControl: {
        requestedBy: 'operator_api',
        route: '/control/tick',
        note: 'manual intervention',
      },
    });
  } finally {
    await cleanup();
  }
});

void test('AC-F0013-05 rejects missing requestId and preserves deterministic replay semantics', async () => {
  let callCount = 0;
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        requestTick: () => {
          callCount += 1;
          return Promise.resolve({ accepted: true });
        },
      }),
    },
  });

  try {
    const invalidResponse = await runtime.fetch(
      new Request('http://yaagi/control/tick', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'reactive',
        }),
      }),
    );
    assert.equal(invalidResponse.status, 400);

    const firstReplay = await runtime.fetch(
      new Request('http://yaagi/control/tick', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requestId: 'operator-request-replay',
          kind: 'reactive',
        }),
      }),
    );
    const secondReplay = await runtime.fetch(
      new Request('http://yaagi/control/tick', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requestId: 'operator-request-replay',
          kind: 'reactive',
        }),
      }),
    );

    assert.equal(firstReplay.status, 202);
    assert.equal(secondReplay.status, 202);
    assert.deepEqual(await firstReplay.json(), await secondReplay.json());
    assert.equal(callCount, 2);
  } finally {
    await cleanup();
  }
});

void test('AC-F0013-05 maps runtime gate rejection reasons to explicit HTTP statuses', async () => {
  const cases = [
    {
      requestId: 'lease-busy',
      reason: 'lease_busy' as const,
      expectedStatus: 409,
    },
    {
      requestId: 'unsupported',
      reason: 'unsupported_tick_kind' as const,
      expectedStatus: 422,
    },
    {
      requestId: 'boot-inactive',
      reason: 'boot_inactive' as const,
      expectedStatus: 503,
    },
  ];

  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        requestTick: (input) => {
          const match = cases.find((entry) => entry.requestId === input.requestId);
          if (!match) {
            return Promise.resolve({ accepted: true });
          }

          return Promise.resolve({
            accepted: false,
            reason: match.reason,
          });
        },
      }),
    },
  });

  try {
    for (const testCase of cases) {
      const response = await runtime.fetch(
        new Request('http://yaagi/control/tick', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            requestId: testCase.requestId,
            kind: 'reactive',
          }),
        }),
      );

      assert.equal(response.status, testCase.expectedStatus);
      assert.deepEqual(await response.json(), {
        accepted: false,
        requestId: testCase.requestId,
        requestedKind: 'reactive',
        reason: testCase.reason,
      });
    }
  } finally {
    await cleanup();
  }
});
