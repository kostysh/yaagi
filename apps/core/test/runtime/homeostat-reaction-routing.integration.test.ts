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

  const secondRun = await service.evaluatePeriodic({
    createdAt: '2026-03-25T12:14:00.000Z',
  });

  assert.equal(secondRun.reactions.length, 0);
  assert.ok(secondRun.skippedIdempotencyKeys.length >= 1);
  assert.ok(persistedSnapshots.length >= 2);
});
