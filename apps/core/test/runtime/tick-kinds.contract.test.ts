import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK_KIND } from '@yaagi/contracts/runtime';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';

void test('AC-F0003-06 delivers wake and reactive as the phase-0 supported tick kinds and rejects the rest explicitly', async () => {
  const harness = createTickRuntimeHarness();
  await harness.runtime.start();

  for (const kind of [
    TICK_KIND.DELIBERATIVE,
    TICK_KIND.CONTEMPLATIVE,
    TICK_KIND.CONSOLIDATION,
    TICK_KIND.DEVELOPMENTAL,
  ]) {
    const result = await harness.runtime.requestTick({
      requestId: `request-${kind}`,
      kind,
      trigger: 'scheduler',
      requestedAt: '2026-03-21T00:00:01Z',
      payload: {},
    });

    assert.deepEqual(result, {
      accepted: false,
      reason: 'unsupported_tick_kind',
    });
  }

  const reactiveResult = await harness.runtime.requestTick({
    requestId: 'reactive-supported',
    kind: TICK_KIND.REACTIVE,
    trigger: 'system',
    requestedAt: '2026-03-21T00:00:02Z',
    payload: {},
  });
  assert.equal(reactiveResult.accepted, true);
});
