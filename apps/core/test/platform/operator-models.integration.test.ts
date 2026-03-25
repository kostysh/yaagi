import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASE0_BASELINE_PROFILE_ID } from '../../src/runtime/index.ts';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

void test('AC-F0013-04 returns bounded baseline model diagnostics and explicit CF-010 future-gap metadata', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        getModelRoutingDiagnostics: () =>
          Promise.resolve([
            {
              modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
              role: 'reflex',
              endpoint: 'http://vllm-fast:8000/v1',
              baseModel: 'model-fast',
              adapterOf: null,
              capabilities: ['reactive'],
              status: 'active',
              eligibility: 'eligible',
              healthSummary: {
                healthy: true,
                detail: 'model-fast dependency is reachable',
              },
            },
          ]),
      }),
    },
  });

  try {
    const response = await runtime.fetch(new Request('http://yaagi/models'));
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      baselineProfiles: Array<{
        modelProfileId: string;
        role: string;
        status: string;
        adapterOf: string | null;
        baseModel: string;
        healthSummary: {
          healthy: boolean;
          detail?: string;
        };
      }>;
      richerRegistryHealth: {
        available: boolean;
        owner: string;
        reason: string;
      };
    };

    assert.deepEqual(payload.baselineProfiles, [
      {
        modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
        role: 'reflex',
        status: 'active',
        adapterOf: null,
        baseModel: 'model-fast',
        healthSummary: {
          healthy: true,
          detail: 'model-fast dependency is reachable',
        },
      },
    ]);
    assert.deepEqual(payload.richerRegistryHealth, {
      available: false,
      owner: 'CF-010',
      reason: 'future_owned',
    });
  } finally {
    await cleanup();
  }
});
