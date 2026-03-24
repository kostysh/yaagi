import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND, TICK_TRIGGER, TICK_STATUS } from '@yaagi/contracts/runtime';
import { createTickRuntime, type TickRuntimeStore } from '../../src/runtime/index.ts';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';

void test('AC-F0003-01 starts the mandatory wake tick only after constitutional activation', async () => {
  const harness = createTickRuntimeHarness({
    now: (() => {
      let step = 0;
      return () => `2026-03-21T00:00:0${step++}Z`;
    })(),
  });

  const beforeStart = await harness.runtime.requestTick({
    requestId: 'prestart-reactive',
    kind: TICK_KIND.REACTIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-21T00:00:00Z',
    payload: {},
  });

  assert.deepEqual(beforeStart, {
    accepted: false,
    reason: 'boot_inactive',
  });

  await harness.runtime.start();

  const wakeTick = [...harness.ticks.values()].find((tick) => tick.kind === TICK_KIND.WAKE);
  assert.ok(wakeTick);
  assert.equal(wakeTick.trigger, TICK_TRIGGER.BOOT);
  assert.equal(wakeTick.status, TICK_STATUS.COMPLETED);
  assert.equal(harness.agentState.currentTick, null);
});

void test('AC-F0003-01 keeps runtime fail-closed when stale-tick reclaim fails during startup', async () => {
  let reclaimAttempts = 0;

  const store: TickRuntimeStore = {
    initialize: () => Promise.resolve(),
    startTick: () => Promise.resolve({ accepted: true, tickId: 'tick-never-started' }),
    finishTick: () => Promise.resolve(),
    reclaimStaleTicks: () => {
      reclaimAttempts += 1;
      return Promise.reject(new Error('reclaim failed'));
    },
  };

  const runtime = createTickRuntime({
    store,
    executeTick: () => ({
      status: TICK_STATUS.COMPLETED,
      summary: 'should never run',
      result: {},
    }),
  });

  await assert.rejects(runtime.start(), /reclaim failed/);
  assert.equal(reclaimAttempts, 1);

  const afterFailedStart = await runtime.requestTick({
    requestId: 'post-failed-start',
    kind: TICK_KIND.REACTIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-21T00:00:01Z',
    payload: {},
  });

  assert.deepEqual(afterFailedStart, {
    accepted: false,
    reason: 'boot_inactive',
  });

  await assert.rejects(runtime.start(), /reclaim failed/);
  assert.equal(reclaimAttempts, 2);
});

void test('AC-F0003-08 does not create wake or reactive ticks from an unsupported subject-state snapshot', async () => {
  let startTickCalls = 0;

  const store: TickRuntimeStore = {
    initialize: () =>
      Promise.reject(
        new Error('unsupported subject-state schema version 2026-03-01; expected 2026-03-24'),
      ),
    startTick: () => {
      startTickCalls += 1;
      return Promise.resolve({ accepted: true, tickId: 'tick-should-not-exist' });
    },
    finishTick: () => Promise.resolve(),
    reclaimStaleTicks: () => Promise.resolve(0),
  };

  const runtime = createTickRuntime({ store });

  await assert.rejects(runtime.start(), /unsupported subject-state schema version/);

  const afterFailedStart = await runtime.requestTick({
    requestId: 'reactive-blocked-after-subject-state-mismatch',
    kind: TICK_KIND.REACTIVE,
    trigger: TICK_TRIGGER.SYSTEM,
    requestedAt: '2026-03-24T00:00:01Z',
    payload: {},
  });

  assert.deepEqual(afterFailedStart, {
    accepted: false,
    reason: 'boot_inactive',
  });
  assert.equal(startTickCalls, 0);
});
