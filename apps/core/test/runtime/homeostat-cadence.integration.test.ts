import test from 'node:test';
import assert from 'node:assert/strict';
import { HOMEOSTAT_CADENCE_KIND } from '@yaagi/contracts/runtime';
import {
  createHomeostatService,
  createPeriodicHomeostatWorker,
  type HomeostatService,
} from '../../src/runtime/index.ts';
import { createBaseHomeostatContext } from '../../testing/homeostat-fixture.ts';

void test('AC-F0012-04 runs the same homeostat evaluator on completed-tick and periodic cadence paths', async () => {
  const service = createHomeostatService({
    createId: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })(),
    loadContext: (input) =>
      Promise.resolve(
        createBaseHomeostatContext({
          cadenceKind: input.cadenceKind,
          tickId: input.tickId,
          createdAt: input.createdAt,
        }),
      ),
    loadLatestSnapshot: () => Promise.resolve(null),
    persistSnapshot: () => Promise.resolve(),
    updateReactionRequestRefs: () => Promise.resolve(),
    enqueueReactionRequest: () => Promise.resolve(),
  });

  const tickComplete = await service.evaluateTickComplete({
    tickId: 'tick-homeostat-cadence',
    createdAt: '2026-03-25T12:30:00.000Z',
  });
  const periodic = await service.evaluatePeriodic({
    createdAt: '2026-03-25T12:30:00.000Z',
  });

  assert.equal(tickComplete.snapshot.cadenceKind, HOMEOSTAT_CADENCE_KIND.TICK_COMPLETE);
  assert.equal(periodic.snapshot.cadenceKind, HOMEOSTAT_CADENCE_KIND.PERIODIC);
  assert.equal(periodic.snapshot.tickId, null);
  assert.deepEqual(
    tickComplete.snapshot.signalScores.map((score) => ({
      signalFamily: score.signalFamily,
      status: score.status,
      severity: score.severity,
      metricValue: score.metricValue,
    })),
    periodic.snapshot.signalScores.map((score) => ({
      signalFamily: score.signalFamily,
      status: score.status,
      severity: score.severity,
      metricValue: score.metricValue,
    })),
  );
});

void test('AC-F0012-07 periodic homeostat evaluation does not require an active tick to emit a bounded snapshot', async () => {
  let persisted = 0;
  const service = createHomeostatService({
    createId: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })(),
    loadContext: (input) =>
      Promise.resolve(
        createBaseHomeostatContext({
          cadenceKind: input.cadenceKind,
          tickId: null,
          createdAt: input.createdAt,
        }),
      ),
    loadLatestSnapshot: () => Promise.resolve(null),
    persistSnapshot: () => {
      persisted += 1;
      return Promise.resolve();
    },
    updateReactionRequestRefs: () => Promise.resolve(),
    enqueueReactionRequest: () => Promise.resolve(),
  });

  const result = await service.evaluatePeriodic({
    createdAt: '2026-03-25T12:35:00.000Z',
  });

  assert.equal(result.snapshot.tickId, null);
  assert.equal(persisted, 1);
});

void test('AC-F0012-04 tears down a partially started periodic worker when scheduler boot fails', async () => {
  const calls: string[] = [];
  const service: HomeostatService = {
    evaluateTickComplete: () => Promise.reject(new Error('not used')),
    evaluatePeriodic: () =>
      Promise.resolve({
        snapshot: {
          snapshotId: 'snapshot-homeostat-worker',
          cadenceKind: HOMEOSTAT_CADENCE_KIND.PERIODIC,
          tickId: null,
          overallStability: 0.8,
          signalScores: [],
          alerts: [],
          reactionRequestRefs: [],
          developmentFreeze: false,
          createdAt: '2026-03-25T12:40:00.000Z',
        },
        reactions: [],
        skippedIdempotencyKeys: [],
      }),
  };
  const worker = createPeriodicHomeostatWorker(
    {
      postgresUrl: 'postgres://unused',
      pgBossSchema: 'pgboss',
    },
    service,
    {
      createBoss: () => ({
        start: () => {
          calls.push('start');
          return Promise.resolve();
        },
        createQueue: () => {
          calls.push('createQueue');
          return Promise.resolve();
        },
        schedule: () => {
          calls.push('schedule');
          return Promise.resolve();
        },
        work: () => {
          calls.push('work');
          return Promise.reject(new Error('worker registration failed'));
        },
        offWork: () => {
          calls.push('offWork');
          return Promise.resolve();
        },
        unschedule: () => {
          calls.push('unschedule');
          return Promise.resolve();
        },
        stop: () => {
          calls.push('stop');
          return Promise.resolve();
        },
      }),
    },
  );

  await assert.rejects(() => worker.start(), /worker registration failed/);
  await worker.stop();

  assert.deepEqual(calls, [
    'start',
    'createQueue',
    'schedule',
    'work',
    'offWork',
    'unschedule',
    'stop',
    'offWork',
    'unschedule',
    'stop',
  ]);
});
