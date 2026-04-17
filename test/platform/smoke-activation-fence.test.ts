import test from 'node:test';
import assert from 'node:assert/strict';
import { runSmokeActivationWithFence } from '../../infra/docker/smoke-activation-fence.ts';

void test('AC-F0021-07 / AC-F0021-08 keeps activation success on the happy path without calling the fail-closed fence', async () => {
  const events: string[] = [];

  await runSmokeActivationWithFence(
    async () => {
      events.push('operation');
      await Promise.resolve();
    },
    async () => {
      events.push('fence');
      await Promise.resolve();
    },
  );

  assert.deepEqual(events, ['operation']);
});

void test('AC-F0021-07 / AC-F0021-08 calls the fail-closed fence and rethrows when activation fails', async () => {
  const events: string[] = [];

  await assert.rejects(
    runSmokeActivationWithFence(
      async () => {
        events.push('operation');
        await Promise.resolve();
        throw new Error('activation_failed');
      },
      async () => {
        events.push('fence');
        await Promise.resolve();
      },
    ),
    /activation_failed/,
  );

  assert.deepEqual(events, ['operation', 'fence']);
});

void test('AC-F0021-07 / AC-F0021-08 fences partial activation state before a retry can succeed', async () => {
  const events: string[] = [];
  const state = {
    partiallyActivated: false,
  };

  await assert.rejects(
    runSmokeActivationWithFence(
      async () => {
        state.partiallyActivated = true;
        events.push('attempt-1');
        await Promise.resolve();
        throw new Error('timeout');
      },
      async () => {
        events.push('fence');
        state.partiallyActivated = false;
        await Promise.resolve();
      },
    ),
    /timeout/,
  );

  await runSmokeActivationWithFence(
    async () => {
      assert.equal(state.partiallyActivated, false);
      events.push('attempt-2');
      await Promise.resolve();
    },
    async () => {
      events.push('unexpected-fence');
      await Promise.resolve();
    },
  );

  assert.deepEqual(events, ['attempt-1', 'fence', 'attempt-2']);
});
