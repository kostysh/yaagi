import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND, TICK_STATUS } from '@yaagi/contracts/runtime';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';

void test('AC-F0003-07 reclaims stale active ticks after restart and clears agent_state.current_tick', async () => {
  const harness = createTickRuntimeHarness({
    seedStartedTick: {
      tickId: 'tick-stale',
      requestId: 'stale-request',
      kind: TICK_KIND.REACTIVE,
      trigger: 'scheduler',
      requestedAt: '2026-03-21T00:00:00Z',
      payload: {},
    },
  });

  await harness.runtime.start();

  const staleTick = harness.ticks.get('tick-stale');
  assert.ok(staleTick);
  assert.equal(staleTick.status, TICK_STATUS.FAILED);
  assert.equal(staleTick.failureDetail, 'stale_tick_reclaimed');
  assert.equal(harness.agentState.currentTick, null);

  const nextResult = await harness.runtime.requestTick({
    requestId: 'reactive-after-reclaim',
    kind: TICK_KIND.REACTIVE,
    trigger: 'scheduler',
    requestedAt: '2026-03-21T00:00:01Z',
    payload: {},
  });

  assert.equal(nextResult.accepted, true);
});
