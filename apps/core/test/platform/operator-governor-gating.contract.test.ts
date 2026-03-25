import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

void test('AC-F0013-06 returns an explicit future-owned contract for freeze-development before CF-016', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        requestTick: () => Promise.resolve({ accepted: true }),
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/control/freeze-development', {
        method: 'POST',
      }),
    );

    assert.equal(response.status, 501);
    assert.deepEqual(await response.json(), {
      available: false,
      action: 'freeze-development',
      owner: 'CF-016',
      reason: 'future_owned',
    });
  } finally {
    await cleanup();
  }
});
