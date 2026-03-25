import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

void test('AC-F0014-05 optional richer organs degrade explicitly without becoming hidden boot-critical dependencies', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        getModelRoutingDiagnostics: () =>
          Promise.resolve([
            {
              modelProfileId: 'reflex.fast@baseline',
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
        getRicherModelRegistryHealthSummary: () =>
          Promise.resolve({
            available: true,
            owner: 'F-0014' as const,
            generatedAt: '2026-03-25T20:20:00.000Z',
            organs: [
              {
                modelProfileId: 'code.deep@shared',
                role: 'code' as const,
                serviceId: 'vllm-deep',
                availability: 'unavailable' as const,
                quarantineState: 'active' as const,
                fallbackTargetProfileId: null,
                errorRate: 1,
                latencyMsP95: null,
              },
              {
                modelProfileId: 'embedding.pool@shared',
                role: 'embedding' as const,
                serviceId: 'vllm-pool',
                availability: 'degraded' as const,
                quarantineState: 'active' as const,
                fallbackTargetProfileId: null,
                errorRate: 0.5,
                latencyMsP95: 260,
              },
            ],
          }),
      }),
    },
  });

  try {
    const started = await runtime.start();
    const response = await fetch(`${started.url}/models`);
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      richerRegistryHealth: {
        available: boolean;
        owner: string;
        organs: Array<{
          modelProfileId: string;
          availability: string;
          quarantineState: string;
        }>;
      };
    };

    assert.deepEqual(
      payload.richerRegistryHealth.organs.map((organ) => ({
        modelProfileId: organ.modelProfileId,
        availability: organ.availability,
        quarantineState: organ.quarantineState,
      })),
      [
        {
          modelProfileId: 'code.deep@shared',
          availability: 'unavailable',
          quarantineState: 'active',
        },
        {
          modelProfileId: 'embedding.pool@shared',
          availability: 'degraded',
          quarantineState: 'active',
        },
      ],
    );
    assert.equal(payload.richerRegistryHealth.available, true);
    assert.equal(payload.richerRegistryHealth.owner, 'F-0014');
  } finally {
    await runtime.stop();
    await cleanup();
  }
});
