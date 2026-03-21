import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND, TICK_STATUS } from '@yaagi/contracts/runtime';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';

void test('AC-F0003-02 prevents overlapping active ticks through DB-backed lease discipline', async () => {
  let releaseExecution: () => void = () => {
    throw new Error('reactive tick execution did not block before release');
  };

  const harness = createTickRuntimeHarness({
    executeTick: async (context) => {
      if (context.requestId === 'reactive-1') {
        await new Promise<void>((resolve) => {
          releaseExecution = resolve;
        });
      }

      return {
        status: TICK_STATUS.COMPLETED,
        summary: `${context.kind} completed`,
        result: { requestId: context.requestId },
      };
    },
  });

  await harness.runtime.start();

  const firstRequest = harness.runtime.requestTick({
    requestId: 'reactive-1',
    kind: TICK_KIND.REACTIVE,
    trigger: 'scheduler',
    requestedAt: '2026-03-21T00:00:01Z',
    payload: {},
  });

  await new Promise((resolve) => setImmediate(resolve));

  const secondRequest = await harness.runtime.requestTick({
    requestId: 'reactive-2',
    kind: TICK_KIND.REACTIVE,
    trigger: 'scheduler',
    requestedAt: '2026-03-21T00:00:02Z',
    payload: {},
  });

  assert.deepEqual(secondRequest, {
    accepted: false,
    reason: 'lease_busy',
  });
  assert.match(harness.agentState.currentTick ?? '', /^tick-/);

  releaseExecution();

  const firstResult = await firstRequest;
  assert.equal(firstResult.accepted, true);
  assert.equal(harness.agentState.currentTick, null);

  const reactiveTicks = [...harness.ticks.values()].filter(
    (tick) => tick.kind === TICK_KIND.REACTIVE,
  );
  assert.equal(reactiveTicks.length, 1);
});
