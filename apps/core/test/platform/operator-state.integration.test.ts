import test from 'node:test';
import assert from 'node:assert/strict';
import type { SubjectStateSnapshot, SubjectStateSnapshotInput } from '@yaagi/db';
import {
  createOperatorAuthHeaders,
  createPlatformTestRuntime,
} from '../../testing/platform-test-fixture.ts';

const snapshot: SubjectStateSnapshot = {
  subjectStateSchemaVersion: '2026-03-25',
  agentState: {
    agentId: 'polyphony-core',
    mode: 'normal',
    currentTickId: 'tick-active',
    currentModelProfileId: 'reflex.fast@baseline',
    lastStableSnapshotId: 'snapshot-123',
    psmJson: { mood: 'steady' },
    resourcePostureJson: { energy: 'high' },
  },
  goals: [
    {
      goalId: 'goal-1',
      title: 'Keep operator API bounded',
      status: 'active',
      priority: 4,
      goalType: 'operational',
      parentGoalId: null,
      rationaleJson: { owner: 'F-0013' },
      evidenceRefs: [{ kind: 'system', note: 'seeded for route test' }],
      updatedAt: '2026-03-25T10:00:00.000Z',
    },
  ],
  beliefs: [
    {
      beliefId: 'belief-1',
      topic: 'operator-api',
      proposition: 'bounded state projections are safer than raw dumps',
      confidence: 0.8,
      status: 'active',
      evidenceRefs: [{ kind: 'system', note: 'route fixture' }],
      updatedAt: '2026-03-25T10:01:00.000Z',
    },
  ],
  entities: [
    {
      entityId: 'entity-1',
      entityKind: 'service',
      canonicalName: 'operator-api',
      stateJson: { status: 'healthy' },
      trustJson: { source: 'fixture' },
      lastSeenAt: '2026-03-25T10:02:00.000Z',
      updatedAt: '2026-03-25T10:02:00.000Z',
    },
  ],
  relationships: [
    {
      srcEntityId: 'entity-1',
      dstEntityId: 'entity-2',
      relationKind: 'depends_on',
      confidence: 0.7,
      updatedAt: '2026-03-25T10:03:00.000Z',
    },
  ],
};

void test('AC-F0013-02 returns a bounded read-only subject-state projection and forwards explicit limits', async () => {
  const receivedInputs: SubjectStateSnapshotInput[] = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        getSubjectStateSnapshot: (input) => {
          receivedInputs.push(input ?? {});
          return Promise.resolve(snapshot);
        },
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request(
        'http://yaagi/state?goalLimit=3&beliefLimit=4&entityLimit=5&relationshipLimit=6',
        {
          headers: createOperatorAuthHeaders('operator'),
        },
      ),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(receivedInputs, [
      {
        goalLimit: 3,
        beliefLimit: 4,
        entityLimit: 5,
        relationshipLimit: 6,
      },
    ]);

    const payload = (await response.json()) as {
      generatedAt: string;
      snapshot: SubjectStateSnapshot;
      bounds: {
        goalLimit: number;
        beliefLimit: number;
        entityLimit: number;
        relationshipLimit: number;
      };
    };

    assert.match(payload.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(payload.snapshot, snapshot);
    assert.deepEqual(payload.bounds, {
      goalLimit: 3,
      beliefLimit: 4,
      entityLimit: 5,
      relationshipLimit: 6,
    });
  } finally {
    await cleanup();
  }
});

void test('AC-F0013-02 rejects oversized state bounds instead of widening the snapshot surface', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        getSubjectStateSnapshot: () => Promise.resolve(snapshot),
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/state?goalLimit=101', {
        headers: createOperatorAuthHeaders('operator'),
      }),
    );
    assert.equal(response.status, 400);

    const payload = (await response.json()) as { error: string };
    assert.match(payload.error, /<=100/i);
  } finally {
    await cleanup();
  }
});
