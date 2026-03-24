import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND, TICK_STATUS } from '@yaagi/contracts/runtime';
import { createTickRuntime, type TickRuntimeStore } from '../../src/runtime/index.ts';
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

void test('AC-F0003-08 refuses runtime activation when subject-state schema version is unsupported', async () => {
  let startTickCalls = 0;

  const store: TickRuntimeStore = {
    initialize: () =>
      Promise.reject(
        new Error('unsupported subject-state schema version 2026-03-01; expected 2026-03-24'),
      ),
    startTick: () => {
      startTickCalls += 1;
      return Promise.resolve({ accepted: true, tickId: 'tick-never-started' });
    },
    finishTick: () => Promise.resolve(),
    reclaimStaleTicks: () => Promise.resolve(0),
  };

  const runtime = createTickRuntime({ store });

  await assert.rejects(runtime.start(), /unsupported subject-state schema version/);

  const result = await runtime.requestTick({
    requestId: 'reactive-after-subject-state-mismatch',
    kind: TICK_KIND.REACTIVE,
    trigger: 'system',
    requestedAt: '2026-03-24T00:00:01Z',
    payload: {},
  });

  assert.deepEqual(result, {
    accepted: false,
    reason: 'boot_inactive',
  });
  assert.equal(startTickCalls, 0);
});
