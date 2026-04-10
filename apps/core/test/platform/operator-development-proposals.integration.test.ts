import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

void test('AC-F0016-04 / AC-F0016-05 forwards operator proposals through the governor gate', async () => {
  const forwardedInputs: Array<{
    requestId: string;
    proposalKind: string;
    problemSignature: string;
    summary: string;
    evidenceRefs: string[];
    rollbackPlanRef: string | null;
    targetRef: string | null;
    requestedAt: string;
  }> = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        submitDevelopmentProposal: (input) => {
          forwardedInputs.push(input);
          return Promise.resolve({
            accepted: true,
            requestId: input.requestId,
            proposalId: 'development-proposal:operator-1',
            state: 'submitted',
            deduplicated: false,
            createdAt: '2026-04-10T12:00:00.000Z',
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

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {
      accepted: true,
      requestId: 'operator-proposal-1',
      proposalId: 'development-proposal:operator-1',
      state: 'submitted',
      deduplicated: false,
      createdAt: '2026-04-10T12:00:00.000Z',
    });
    assert.equal(forwardedInputs.length, 1);
    assert.equal(forwardedInputs[0]?.proposalKind, 'code_change');
    assert.equal(forwardedInputs[0]?.rollbackPlanRef, 'rollback:code-change:1');
    assert.match(forwardedInputs[0]?.requestedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await cleanup();
  }
});

void test('AC-F0016-07 rejects unsupported proposal classes before the governor gate', async () => {
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

    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), {
      accepted: false,
      reason: 'unsupported_proposal_kind',
    });
    assert.equal(callCount, 0);
  } finally {
    await cleanup();
  }
});

void test('AC-F0016-04 / AC-F0016-06 maps proposal rejection reasons to explicit HTTP statuses', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        submitDevelopmentProposal: (input) =>
          Promise.resolve({
            accepted: false,
            requestId: input.requestId,
            reason:
              input.requestId === 'proposal-conflict'
                ? 'conflicting_request_id'
                : input.requestId === 'proposal-frozen'
                  ? 'development_frozen'
                  : input.requestId === 'proposal-under-specified'
                    ? 'insufficient_evidence'
                    : 'persistence_unavailable',
          }),
      }),
    },
  });

  try {
    for (const [requestId, expectedStatus] of [
      ['proposal-conflict', 409],
      ['proposal-frozen', 409],
      ['proposal-under-specified', 422],
      ['proposal-unavailable', 503],
    ] as const) {
      const response = await runtime.fetch(
        new Request('http://yaagi/control/development-proposals', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            requestId,
            proposalKind: 'policy_change',
            problemSignature: 'proposal status mapping',
            summary: 'Validate bounded HTTP mapping.',
            evidenceRefs: ['operator:evidence:1'],
            rollbackPlanRef: 'rollback:policy:1',
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

void test('AC-F0016-05 fails closed when proposal governor gate is not registered', async () => {
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

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      accepted: false,
      reason: 'persistence_unavailable',
    });
  } finally {
    await cleanup();
  }
});
