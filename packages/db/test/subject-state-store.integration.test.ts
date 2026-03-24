import test from 'node:test';
import assert from 'node:assert/strict';
import { createTickRuntimeStore } from '../src/index.ts';
import { createSubjectStateDbHarness } from '../testing/subject-state-db-harness.ts';

void test('AC-F0004-01 uses PostgreSQL as the canonical subject-memory state kernel', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-23',
        bootStateJson: {},
        currentTickId: null,
        currentModelProfileId: 'model-fast@stable',
        lastStableSnapshotId: 'snapshot-42',
        psmJson: { mood: 'steady' },
        resourcePostureJson: { cpu: 'normal' },
        developmentFreeze: false,
        updatedAt: '2026-03-23T00:00:00.000Z',
      },
      goals: {
        'goal-alpha': {
          goalId: 'goal-alpha',
          title: 'Protect continuity',
          status: 'active',
          priority: 8,
          goalType: 'continuity',
          parentGoalId: null,
          rationaleJson: { source: 'constitution' },
          evidenceRefs: [{ kind: 'system', note: 'boot' }],
          updatedAt: '2026-03-23T00:00:10.000Z',
        },
      },
      beliefs: {
        'belief-alpha': {
          beliefId: 'belief-alpha',
          topic: 'runtime',
          proposition: 'postgres is available',
          confidence: 0.9,
          status: 'active',
          evidenceRefs: [{ kind: 'episode', episodeId: 'episode-1' }],
          updatedAt: '2026-03-23T00:00:20.000Z',
        },
      },
      entities: {
        'entity-alpha': {
          entityId: 'entity-alpha',
          entityKind: 'service',
          canonicalName: 'Postgres',
          stateJson: { ready: true },
          trustJson: { confidence: 0.9 },
          lastSeenAt: '2026-03-23T00:00:30.000Z',
          updatedAt: '2026-03-23T00:00:30.000Z',
        },
      },
      relationships: {
        'entity-alpha|entity-alpha|self': {
          srcEntityId: 'entity-alpha',
          dstEntityId: 'entity-alpha',
          relationKind: 'self',
          confidence: 1,
          updatedAt: '2026-03-23T00:00:40.000Z',
        },
      },
    },
  });
  const store = createTickRuntimeStore(harness.db);

  const snapshot = await store.loadSubjectStateSnapshot();

  assert.equal(snapshot.subjectStateSchemaVersion, '2026-03-23');
  assert.equal(snapshot.agentState.agentId, 'polyphony-core');
  assert.equal(snapshot.agentState.currentModelProfileId, 'model-fast@stable');
  assert.equal(snapshot.agentState.lastStableSnapshotId, 'snapshot-42');
  assert.deepEqual(snapshot.agentState.psmJson, { mood: 'steady' });
  assert.deepEqual(snapshot.agentState.resourcePostureJson, { cpu: 'normal' });
  assert.equal(snapshot.goals.length, 1);
  assert.equal(snapshot.beliefs.length, 1);
  assert.equal(snapshot.entities.length, 1);
  assert.equal(snapshot.relationships.length, 1);
});

void test('AC-F0004-02 reloads the singleton agent_state with identity-bearing fields after boot handoff', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'recovery',
        schemaVersion: '2026-03-23',
        bootStateJson: { mode: 'recovery' },
        currentTickId: 'tick-bootstrap',
        currentModelProfileId: 'model-recovery@stable',
        lastStableSnapshotId: 'snapshot-99',
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-23T00:00:00.000Z',
      },
    },
  });
  const store = createTickRuntimeStore(harness.db);

  const anchor = await store.ensureSubjectStateAnchor();

  assert.equal(anchor.agentId, 'polyphony-core');
  assert.equal(anchor.mode, 'recovery');
  assert.equal(anchor.currentTickId, 'tick-bootstrap');
  assert.equal(anchor.currentModelProfileId, 'model-recovery@stable');
  assert.equal(anchor.lastStableSnapshotId, 'snapshot-99');
  assert.deepEqual(anchor.psmJson, {});
  assert.deepEqual(anchor.resourcePostureJson, {});
});

void test('AC-F0004-07 surfaces subjectStateSchemaVersion in the bounded snapshot contract', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-24',
        bootStateJson: {},
        currentTickId: null,
        currentModelProfileId: null,
        lastStableSnapshotId: null,
        psmJson: {},
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    },
  });
  const store = createTickRuntimeStore(harness.db);

  const snapshot = await store.loadSubjectStateSnapshot({
    goalLimit: 0,
    beliefLimit: 0,
    entityLimit: 0,
    relationshipLimit: 0,
  });

  assert.equal(snapshot.subjectStateSchemaVersion, '2026-03-24');
});

void test('AC-F0004-04 assembles a bounded subjective snapshot without narrative or memetic prerequisites', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      goals: {
        'goal-high': {
          goalId: 'goal-high',
          title: 'High priority',
          status: 'active',
          priority: 10,
          goalType: 'continuity',
          parentGoalId: null,
          rationaleJson: {},
          evidenceRefs: [],
          updatedAt: '2026-03-23T00:00:04.000Z',
        },
        'goal-mid': {
          goalId: 'goal-mid',
          title: 'Mid priority',
          status: 'blocked',
          priority: 5,
          goalType: 'coordination',
          parentGoalId: null,
          rationaleJson: {},
          evidenceRefs: [],
          updatedAt: '2026-03-23T00:00:03.000Z',
        },
        'goal-done': {
          goalId: 'goal-done',
          title: 'Should not load',
          status: 'completed',
          priority: 99,
          goalType: 'ignored',
          parentGoalId: null,
          rationaleJson: {},
          evidenceRefs: [],
          updatedAt: '2026-03-23T00:00:02.000Z',
        },
      },
      beliefs: {
        'belief-high': {
          beliefId: 'belief-high',
          topic: 'alpha',
          proposition: 'alpha true',
          confidence: 0.9,
          status: 'active',
          evidenceRefs: [],
          updatedAt: '2026-03-23T00:00:02.000Z',
        },
        'belief-mid': {
          beliefId: 'belief-mid',
          topic: 'beta',
          proposition: 'beta true',
          confidence: 0.7,
          status: 'candidate',
          evidenceRefs: [],
          updatedAt: '2026-03-23T00:00:03.000Z',
        },
        'belief-low': {
          beliefId: 'belief-low',
          topic: 'gamma',
          proposition: 'gamma true',
          confidence: 0.1,
          status: 'rejected',
          evidenceRefs: [],
          updatedAt: '2026-03-23T00:00:04.000Z',
        },
      },
      entities: {
        'entity-b': {
          entityId: 'entity-b',
          entityKind: 'person',
          canonicalName: 'Beta',
          stateJson: {},
          trustJson: {},
          lastSeenAt: '2026-03-23T00:00:03.000Z',
          updatedAt: '2026-03-23T00:00:03.000Z',
        },
        'entity-a': {
          entityId: 'entity-a',
          entityKind: 'person',
          canonicalName: 'Alpha',
          stateJson: {},
          trustJson: {},
          lastSeenAt: '2026-03-23T00:00:04.000Z',
          updatedAt: '2026-03-23T00:00:04.000Z',
        },
        'entity-z': {
          entityId: 'entity-z',
          entityKind: 'person',
          canonicalName: 'Zulu',
          stateJson: {},
          trustJson: {},
          lastSeenAt: '2026-03-23T00:00:05.000Z',
          updatedAt: '2026-03-23T00:00:05.000Z',
        },
      },
      relationships: {
        'entity-a|entity-b|knows': {
          srcEntityId: 'entity-a',
          dstEntityId: 'entity-b',
          relationKind: 'knows',
          confidence: 0.8,
          updatedAt: '2026-03-23T00:00:06.000Z',
        },
        'entity-a|entity-z|knows': {
          srcEntityId: 'entity-a',
          dstEntityId: 'entity-z',
          relationKind: 'knows',
          confidence: 0.2,
          updatedAt: '2026-03-23T00:00:07.000Z',
        },
      },
    },
  });
  const store = createTickRuntimeStore(harness.db);

  const snapshot = await store.loadSubjectStateSnapshot({
    goalLimit: 2,
    beliefLimit: 2,
    entityLimit: 2,
    relationshipLimit: 10,
  });

  assert.deepEqual(
    snapshot.goals.map((goal) => goal.goalId),
    ['goal-high', 'goal-mid'],
  );
  assert.deepEqual(
    snapshot.beliefs.map((belief) => belief.beliefId),
    ['belief-high', 'belief-mid'],
  );
  assert.deepEqual(
    snapshot.entities.map((entity) => entity.entityId),
    ['entity-a', 'entity-b'],
  );
  assert.deepEqual(snapshot.relationships, [
    {
      srcEntityId: 'entity-a',
      dstEntityId: 'entity-b',
      relationKind: 'knows',
      confidence: 0.8,
      updatedAt: '2026-03-23T00:00:06.000Z',
    },
  ]);
});
