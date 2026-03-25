import test from 'node:test';
import assert from 'node:assert/strict';
import { HOMEOSTAT_CADENCE_KIND } from '@yaagi/contracts/runtime';
import { createHomeostatService } from '../../src/runtime/index.ts';
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
