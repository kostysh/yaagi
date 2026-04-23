import test from 'node:test';
import assert from 'node:assert/strict';
import type { SubjectStateSnapshot } from '@yaagi/db';
import {
  createOperatorAuthHeaders,
  createPlatformTestRuntime,
} from '../../testing/platform-test-fixture.ts';

// Coverage refs: AC-F0024-02 AC-F0024-14 AC-F0024-15

const subjectStateSnapshot: SubjectStateSnapshot = {
  subjectStateSchemaVersion: '2026-03-25',
  agentState: {
    agentId: 'polyphony-core',
    mode: 'normal',
    currentTickId: null,
    currentModelProfileId: 'reflex.fast@baseline',
    lastStableSnapshotId: 'snapshot-1',
    psmJson: { focus: 'operator-boundary' },
    resourcePostureJson: { memory: 'steady' },
  },
  goals: [],
  beliefs: [],
  entities: [],
  relationships: [],
};

void test('AC-F0013-01 keeps operator routes absent until canonical owner adapters exist', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
      }),
    },
  });

  try {
    const stateResponse = await runtime.fetch(
      new Request('http://yaagi/state', {
        headers: createOperatorAuthHeaders('operator'),
      }),
    );
    const modelsResponse = await runtime.fetch(new Request('http://yaagi/models'));
    const freezeResponse = await runtime.fetch(
      new Request('http://yaagi/control/freeze-development', {
        method: 'POST',
      }),
    );

    assert.equal(stateResponse.status, 404);
    assert.equal(modelsResponse.status, 404);
    assert.equal(freezeResponse.status, 404);
  } finally {
    await cleanup();
  }
});

void test('AC-F0013-01 / AC-F0013-07 / AC-F0013-08 wires operator routes on the canonical runtime boundary without seizing /health or adding write endpoints', async () => {
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
        getSubjectStateSnapshot: () => Promise.resolve(subjectStateSnapshot),
      }),
    },
  });

  try {
    const healthResponse = await runtime.fetch(new Request('http://yaagi/health'));
    const stateResponse = await runtime.fetch(
      new Request('http://yaagi/state', {
        headers: createOperatorAuthHeaders('operator'),
      }),
    );
    const statePatchResponse = await runtime.fetch(
      new Request('http://yaagi/state', {
        method: 'PATCH',
      }),
    );
    const timelineDeleteResponse = await runtime.fetch(
      new Request('http://yaagi/timeline', {
        method: 'DELETE',
      }),
    );

    assert.equal(healthResponse.status, 200);
    assert.equal(stateResponse.status, 200);
    assert.equal(statePatchResponse.status, 404);
    assert.equal(timelineDeleteResponse.status, 404);
  } finally {
    await cleanup();
  }
});
