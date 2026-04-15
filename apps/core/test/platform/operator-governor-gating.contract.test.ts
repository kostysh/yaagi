import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

// Coverage refs: AC-F0013-06 AC-F0018-01

const expectedUnavailableResponse = {
  available: false,
  action: 'freeze-development',
  owner: 'CF-024',
  reason: 'caller_admission_required',
} as const;

void test('AC-F0013-06 keeps freeze-development explicit unavailable until caller admission is delivered', async () => {
  let callCount = 0;
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        freezeDevelopment: () => {
          callCount += 1;
          return Promise.resolve({
            accepted: true,
            requestId: 'should-not-run',
            freezeId: 'should-not-run',
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

    assert.equal(response.status, 501);
    assert.deepEqual(await response.json(), expectedUnavailableResponse);
    assert.equal(callCount, 0);
  } finally {
    await cleanup();
  }
});

void test('AC-F0013-06 returns the same explicit unavailable contract even for invalid freeze payloads', async () => {
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
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'missing request id',
        }),
      }),
    );

    assert.equal(response.status, 501);
    assert.deepEqual(await response.json(), expectedUnavailableResponse);
    assert.equal(callCount, 0);
  } finally {
    await cleanup();
  }
});

void test('AC-F0013-06 fails closed on freeze-development when the governor seam is absent', async () => {
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

    assert.equal(response.status, 501);
    assert.deepEqual(await response.json(), expectedUnavailableResponse);
  } finally {
    await cleanup();
  }
});
