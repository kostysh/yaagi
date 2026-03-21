import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND, TICK_STATUS } from '@yaagi/contracts/runtime';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';

void test('AC-F0003-03 maintains agent_state.current_tick atomically across active and terminal tick transitions', async () => {
  let releaseExecution: () => void = () => {
    throw new Error('reactive tick execution did not block before release');
  };

  const harness = createTickRuntimeHarness({
    executeTick: async (context) => {
      if (context.requestId === 'reactive-pointer') {
        await new Promise<void>((resolve) => {
          releaseExecution = resolve;
        });
      }

      return {
        status: TICK_STATUS.COMPLETED,
        summary: 'reactive completed',
        result: { ok: true },
      };
    },
  });

  await harness.runtime.start();

  const request = harness.runtime.requestTick({
    requestId: 'reactive-pointer',
    kind: TICK_KIND.REACTIVE,
    trigger: 'system',
    requestedAt: '2026-03-21T00:00:01Z',
    payload: {},
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.match(harness.agentState.currentTick ?? '', /^tick-/);

  releaseExecution();
  const result = await request;
  assert.equal(result.accepted, true);
  assert.equal(harness.agentState.currentTick, null);

  const reactiveTickId = [...harness.ticks.values()].find(
    (tick) => tick.requestId === 'reactive-pointer',
  )?.tickId;
  assert.ok(reactiveTickId);

  const lifecycleEvents = harness.events
    .filter((event) => event.subjectRef === reactiveTickId)
    .slice(-2)
    .map((event) => event.eventType);
  assert.deepEqual(lifecycleEvents, ['tick.started', 'tick.completed']);
});
