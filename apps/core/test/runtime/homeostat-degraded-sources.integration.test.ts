import test from 'node:test';
import assert from 'node:assert/strict';
import { HOMEOSTAT_SIGNAL_FAMILY, HOMEOSTAT_SIGNAL_STATUS } from '@yaagi/contracts/runtime';
import { createHomeostatService } from '../../src/runtime/index.ts';
import { createBaseHomeostatContext } from '../../testing/homeostat-fixture.ts';

void test('AC-F0012-03 degrades CF-015 / CF-016 / CF-018-backed signals without fabricating proxy metrics', async () => {
  const persistedSnapshots: { snapshotId: string }[] = [];
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
    persistSnapshot: (snapshot) => {
      persistedSnapshots.push({ snapshotId: snapshot.snapshotId });
      return Promise.resolve();
    },
    updateReactionRequestRefs: () => Promise.resolve(),
    enqueueReactionRequest: () => Promise.resolve(),
  });

  const result = await service.evaluatePeriodic({
    createdAt: '2026-03-25T12:05:00.000Z',
  });

  const degradedFamilies = result.snapshot.signalScores
    .filter((score) => score.status === HOMEOSTAT_SIGNAL_STATUS.NOT_EVALUABLE)
    .map((score) => score.signalFamily)
    .sort();
  const degradedFamilySet = new Set(degradedFamilies);

  assert.deepEqual(degradedFamilies, [
    HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE,
    HOMEOSTAT_SIGNAL_FAMILY.ORGAN_ERROR_RATE,
    HOMEOSTAT_SIGNAL_FAMILY.ROLLBACK_FREQUENCY,
  ]);
  assert.ok(
    result.snapshot.signalScores
      .filter((score) => degradedFamilySet.has(score.signalFamily))
      .every((score) => score.metricValue === null),
  );
  assert.equal(persistedSnapshots.length, 1);
});
