import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

// Coverage refs: AC-F0013-06 AC-F0016-04 AC-F0016-05 AC-F0018-01

const expectedUnavailableResponse = {
  available: false,
  action: 'development-proposals',
  owner: 'CF-024',
  reason: 'caller_admission_required',
} as const;

void test('AC-F0013-06 keeps development-proposals explicit unavailable until caller admission is delivered', async () => {
  let callCount = 0;
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        submitDevelopmentProposal: () => {
          callCount += 1;
          return Promise.resolve({
            accepted: true,
            requestId: 'should-not-run',
            proposalId: 'should-not-run',
            state: 'submitted',
            deduplicated: false,
            createdAt: '2026-04-15T12:30:00.000Z',
          });
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/development-proposals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requestId: 'operator-proposal-1',
          proposalKind: 'code_change',
          problemSignature: 'runtime needs bounded code-evolution proposal',
          summary: 'Record advisory proposal without mutating body state.',
          evidenceRefs: ['operator:evidence:1'],
          rollbackPlanRef: 'rollback:code-change:1',
          targetRef: 'workspace:body',
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

void test('AC-F0013-06 returns the same explicit unavailable contract for unsupported proposal kinds', async () => {
  let callCount = 0;
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        submitDevelopmentProposal: () => {
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
      new Request('http://yaagi/control/development-proposals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requestId: 'operator-proposal-unsupported',
          proposalKind: 'release_change',
          problemSignature: 'unsupported class',
          summary: 'Unsupported proposal classes must fail closed.',
          evidenceRefs: ['operator:evidence:1'],
          rollbackPlanRef: 'rollback:unsupported:1',
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

void test('AC-F0013-06 fails closed on development-proposals when the governor seam is not registered', async () => {
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
      new Request('http://yaagi/control/development-proposals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requestId: 'operator-proposal-1',
          proposalKind: 'model_adapter',
          problemSignature: 'missing governor gate',
          summary: 'Route must fail closed without the owner gate.',
          evidenceRefs: ['operator:evidence:1'],
          rollbackPlanRef: 'rollback:adapter:1',
        }),
      }),
    );

    assert.equal(response.status, 501);
    assert.deepEqual(await response.json(), expectedUnavailableResponse);
  } finally {
    await cleanup();
  }
});
