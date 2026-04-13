import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

// Coverage refs: AC-F0017-31 AC-F0017-32 AC-F0017-33

void test('AC-F0017-31 / AC-F0017-32 / AC-F0017-33 keep public body execution, environment promotion and release activation routes absent', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
      }),
    },
  });

  try {
    const bodyExecution = await runtime.fetch(
      new Request('http://yaagi/control/body-changes', {
        method: 'POST',
      }),
    );
    const environmentPromotion = await runtime.fetch(
      new Request('http://yaagi/control/environment-promotions', {
        method: 'POST',
      }),
    );
    const releaseActivation = await runtime.fetch(
      new Request('http://yaagi/control/release-activation', {
        method: 'POST',
      }),
    );

    assert.equal(bodyExecution.status, 404);
    assert.equal(environmentPromotion.status, 404);
    assert.equal(releaseActivation.status, 404);
  } finally {
    await cleanup();
  }
});
