import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND, TICK_STATUS } from '@yaagi/contracts/runtime';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';

void test('AC-F0003-05 releases the active lease and records failure context after a failed tick', async () => {
  const harness = createTickRuntimeHarness({
    executeTick: (context) => {
      if (context.requestId === 'reactive-failure') {
        throw new Error('simulated tick failure');
      }

      return {
        status: TICK_STATUS.COMPLETED,
        summary: `${context.kind} completed`,
        result: { requestId: context.requestId },
      };
    },
  });

  await harness.runtime.start();

  const result = await harness.runtime.requestTick({
    requestId: 'reactive-failure',
    kind: TICK_KIND.REACTIVE,
    trigger: 'system',
    requestedAt: '2026-03-21T00:00:01Z',
    payload: {},
  });

  assert.equal(result.accepted, true);
  assert.equal(harness.agentState.currentTick, null);

  const failedTick = [...harness.ticks.values()].find(
    (tick) => tick.requestId === 'reactive-failure',
  );
  assert.ok(failedTick);
  assert.equal(failedTick.status, TICK_STATUS.FAILED);
  assert.equal(failedTick.failureDetail, 'simulated tick failure');

  const failureEvent = harness.events.find(
    (event) => event.subjectRef === failedTick.tickId && event.eventType === 'tick.failed',
  );
  assert.ok(failureEvent);

  const nextResult = await harness.runtime.requestTick({
    requestId: 'reactive-after-failure',
    kind: TICK_KIND.REACTIVE,
    trigger: 'scheduler',
    requestedAt: '2026-03-21T00:00:02Z',
    payload: {},
  });

  assert.equal(nextResult.accepted, true);
});
