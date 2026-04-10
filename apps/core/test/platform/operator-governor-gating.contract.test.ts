import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

void test('AC-F0016-01 forwards freeze-development through the runtime governor gate', async () => {
  const forwardedInputs: Array<{
    requestId: string;
    reason: string;
    evidenceRefs: string[];
    requestedBy: string;
    requestedAt: string;
  }> = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        freezeDevelopment: (input) => {
          forwardedInputs.push(input);
          return Promise.resolve({
            accepted: true,
            requestId: input.requestId,
            freezeId: 'development-freeze:operator-1',
            state: 'frozen',
            triggerKind: 'operator',
            decisionOrigin: 'operator',
            deduplicated: false,
            createdAt: '2026-04-10T12:00:00.000Z',
          });
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/freeze-development', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
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
      freezeId: 'development-freeze:operator-1',
      state: 'frozen',
      triggerKind: 'operator',
      decisionOrigin: 'operator',
      deduplicated: false,
      createdAt: '2026-04-10T12:00:00.000Z',
    });
    assert.equal(forwardedInputs.length, 1);
    assert.equal(forwardedInputs[0]?.requestedBy, 'operator_api');
    assert.match(forwardedInputs[0]?.requestedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(forwardedInputs[0]?.evidenceRefs, ['operator:manual-control']);
  } finally {
    await cleanup();
  }
});

void test('AC-F0016-01 rejects invalid freeze-development payloads before the governor gate', async () => {
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
        headers: {
          'content-type': 'application/json',
        },
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

void test('AC-F0016-02 maps governor conflict and unavailable states to explicit HTTP statuses', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        freezeDevelopment: (input) =>
          Promise.resolve({
            accepted: false,
            requestId: input.requestId,
            reason:
              input.requestId === 'conflict-freeze'
                ? 'conflicting_request_id'
                : 'persistence_unavailable',
          }),
      }),
    },
  });

  try {
    for (const [requestId, expectedStatus] of [
      ['conflict-freeze', 409],
      ['unavailable-freeze', 503],
    ] as const) {
      const response = await runtime.fetch(
        new Request('http://yaagi/control/freeze-development', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            requestId,
            reason: 'test mapping',
          }),
        }),
      );

      assert.equal(response.status, expectedStatus);
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(body['requestId'], requestId);
    }
  } finally {
    await cleanup();
  }
});

void test('AC-F0016-01 fails closed when the freeze governor gate is not registered', async () => {
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
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requestId: 'operator-freeze-1',
          reason: 'manual stop before risky change',
        }),
      }),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      accepted: false,
      reason: 'persistence_unavailable',
    });
  } finally {
    await cleanup();
  }
});
