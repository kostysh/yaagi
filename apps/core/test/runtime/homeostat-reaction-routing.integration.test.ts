import test from 'node:test';
import assert from 'node:assert/strict';
import { HOMEOSTAT_REACTION_QUEUE } from '@yaagi/contracts/runtime';
import { createHomeostatService } from '../../src/runtime/index.ts';
import {
  createBaseHomeostatContext,
  createSnapshotForDedupe,
} from '../../testing/homeostat-fixture.ts';

void test('AC-F0012-05 publishes bounded homeostat reaction requests through owner gates without direct execution', async () => {
  const enqueued: Array<Record<string, unknown>> = [];
  const persistedSnapshots: string[] = [];
  let latestSnapshot = null as ReturnType<typeof createSnapshotForDedupe> | null;
  const createId = (() => {
    let index = 0;
    return () => `id-${++index}`;
  })();

  const service = createHomeostatService({
    createId,
    loadContext: (input) =>
      Promise.resolve(
        createBaseHomeostatContext({
          cadenceKind: input.cadenceKind,
          tickId: input.tickId,
          createdAt: input.createdAt,
        }),
      ),
    loadLatestSnapshot: () => Promise.resolve(latestSnapshot),
    persistSnapshot: (snapshot) => {
      persistedSnapshots.push(snapshot.snapshotId);
      return Promise.resolve();
    },
    updateReactionRequestRefs: () => Promise.resolve(),
    enqueueReactionRequest: (request) => {
      enqueued.push({
        queueName: HOMEOSTAT_REACTION_QUEUE,
        ...request,
      });
      return Promise.resolve();
    },
  });

  const firstRun = await service.evaluatePeriodic({
    createdAt: '2026-03-25T12:10:00.000Z',
  });

  assert.ok(enqueued.length >= 1);
  assert.ok(
    enqueued.every(
      (request) =>
        request['queueName'] === HOMEOSTAT_REACTION_QUEUE &&
        !Object.hasOwn(request, 'psmJson') &&
        !Object.hasOwn(request, 'goals') &&
        !Object.hasOwn(request, 'developmentFreeze'),
    ),
  );
  assert.ok(firstRun.snapshot.reactionRequestRefs.length >= 1);

  latestSnapshot = createSnapshotForDedupe({
    alerts: firstRun.snapshot.alerts,
    createdAt: '2026-03-25T12:12:00.000Z',
  });
  latestSnapshot = {
    ...latestSnapshot,
    reactionRequestRefs: firstRun.snapshot.reactionRequestRefs,
  };

  const secondRun = await service.evaluatePeriodic({
    createdAt: '2026-03-25T12:14:00.000Z',
  });

  assert.equal(secondRun.reactions.length, 0);
  assert.ok(secondRun.skippedIdempotencyKeys.length >= 1);
  assert.ok(persistedSnapshots.length >= 2);
});

void test('AC-F0012-05 retries bounded reaction publication when the previous snapshot did not persist reaction refs', async () => {
  const enqueued: Array<Record<string, unknown>> = [];
  const createId = (() => {
    let index = 0;
    return () => `id-${++index}`;
  })();

  const previousSnapshot = {
    ...createSnapshotForDedupe({
      alerts: [
        {
          signalFamily: 'affect_volatility',
          status: 'evaluated',
          severity: 'critical',
          metricValue: 0.82,
          warningThreshold: 0.45,
          criticalThreshold: 0.7,
          evidenceRefs: ['narrative:narrative-homeostat-1', 'journal:journal-homeostat-1'],
          requestedActionKinds: ['reflective_counterweight'],
          idempotencyKeys: [
            'affect_volatility|critical|reflective_counterweight|journal:journal-homeostat-1|narrative:narrative-homeostat-1',
          ],
        },
      ],
      createdAt: '2026-03-25T12:12:00.000Z',
    }),
    reactionRequestRefs: [],
  };

  const service = createHomeostatService({
    createId,
    loadContext: (input) =>
      Promise.resolve(
        createBaseHomeostatContext({
          cadenceKind: input.cadenceKind,
          tickId: input.tickId,
          createdAt: input.createdAt,
        }),
      ),
    loadLatestSnapshot: () => Promise.resolve(previousSnapshot),
    persistSnapshot: () => Promise.resolve(),
    updateReactionRequestRefs: () => Promise.resolve(),
    enqueueReactionRequest: (request) => {
      enqueued.push(request as Record<string, unknown>);
      return Promise.resolve();
    },
  });

  const rerun = await service.evaluatePeriodic({
    createdAt: '2026-03-25T12:14:00.000Z',
  });

  assert.ok(rerun.reactions.length >= 1);
  assert.equal(rerun.skippedIdempotencyKeys.length, 0);
  assert.ok(enqueued.length >= 1);
});
