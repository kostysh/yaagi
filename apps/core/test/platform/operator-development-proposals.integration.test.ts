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
  action: 'development-proposals',
  owner: 'F-0016',
  reason: 'downstream_owner_unavailable',
} as const;

void test('AC-F0024-08 admits governor operators before forwarding development proposals to the owner gate', async () => {
  let callCount = 0;
  const forwardedEvidenceRefs: string[][] = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        submitDevelopmentProposal: (input) => {
          callCount += 1;
          forwardedEvidenceRefs.push(input.evidenceRefs);
          return Promise.resolve({
            accepted: true,
            requestId: input.requestId,
            proposalId: 'development-proposal:1',
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
        headers: createOperatorAuthHeaders('governor', {
          'content-type': 'application/json',
          'x-request-id': 'http-request-proposal-1',
        }),
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
      proposalId: 'development-proposal:1',
      state: 'submitted',
      deduplicated: false,
      createdAt: '2026-04-15T12:30:00.000Z',
    });
    assert.equal(callCount, 1);
    assert.equal(forwardedEvidenceRefs.length, 1);
    assert.equal(forwardedEvidenceRefs[0]?.[0], 'operator:evidence:1');
    assert.match(forwardedEvidenceRefs[0]?.[1] ?? '', /^operator-auth-evidence:/);
    assert.equal((forwardedEvidenceRefs[0]?.[1] ?? '').length <= 200, true);
  } finally {
    await cleanup();
  }
});

void test('AC-F0024-08 rejects invalid proposal payloads after caller admission without owner calls', async () => {
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
        headers: createOperatorAuthHeaders('governor', {
          'content-type': 'application/json',
        }),
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

    assert.equal(response.status, 400);
    assert.equal(callCount, 0);
  } finally {
    await cleanup();
  }
});

void test('AC-F0024-08 rejects oversized proposal payloads before owner calls', async () => {
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
        headers: createOperatorAuthHeaders('governor', {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          requestId: 'operator-proposal-oversized',
          proposalKind: 'code_change',
          problemSignature: 'oversized proposal body',
          summary: 'Oversized proposal body must fail before the owner gate.',
          evidenceRefs: [],
          rollbackPlanRef: null,
          targetRef: null,
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

void test('AC-F0024-08 fails closed on development-proposals when the governor seam is not registered', async () => {
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
        headers: createOperatorAuthHeaders('governor', {
          'content-type': 'application/json',
        }),
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
    assert.deepEqual(await response.json(), expectedUnavailableResponse);
  } finally {
    await cleanup();
  }
});
