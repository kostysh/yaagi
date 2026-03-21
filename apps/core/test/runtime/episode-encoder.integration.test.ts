import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND, TICK_STATUS } from '@yaagi/contracts/runtime';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';

void test('AC-F0003-04 commits the episode atomically with its owning tick', async () => {
  const harness = createTickRuntimeHarness({
    executeTick: () => ({
      status: TICK_STATUS.COMPLETED,
      summary: 'episode committed',
      result: { outcome: 'completed' },
    }),
  });

  await harness.runtime.start();

  const result = await harness.runtime.requestTick({
    requestId: 'reactive-episode',
    kind: TICK_KIND.REACTIVE,
    trigger: 'system',
    requestedAt: '2026-03-21T00:00:01Z',
    payload: {},
  });

  assert.equal(result.accepted, true);

  const reactiveTick = [...harness.ticks.values()].find(
    (tick) => tick.requestId === 'reactive-episode',
  );
  assert.ok(reactiveTick);
  assert.equal(reactiveTick.status, TICK_STATUS.COMPLETED);

  const episode = harness.episodes.find((entry) => entry.tickId === reactiveTick.tickId);
  assert.ok(episode);
  assert.equal(episode.summary, 'episode committed');
  assert.deepEqual(episode.result, { outcome: 'completed' });
});
