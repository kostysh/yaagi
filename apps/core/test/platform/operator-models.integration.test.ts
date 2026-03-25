import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASE0_BASELINE_PROFILE_ID } from '../../src/runtime/index.ts';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

void test('AC-F0013-04 returns bounded baseline model diagnostics and the F-0014 richer registry projection', async () => {
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
        getRicherModelRegistryHealthSummary: () =>
          Promise.resolve({
            available: true,
            owner: 'F-0014' as const,
            generatedAt: '2026-03-25T21:00:00.000Z',
            organs: [
              {
                modelProfileId: 'code.deep@shared',
                role: 'code' as const,
                serviceId: 'vllm-deep',
                availability: 'available' as const,
                quarantineState: 'clear' as const,
                fallbackTargetProfileId: null,
                errorRate: 0,
                latencyMsP95: 125,
              },
            ],
          }),
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
        generatedAt: string;
        organs: Array<{
          modelProfileId: string;
          role: string;
          serviceId: string;
          availability: string;
          quarantineState: string;
          fallbackTargetProfileId: string | null;
          errorRate: number | null;
          latencyMsP95: number | null;
        }>;
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
      available: true,
      owner: 'F-0014',
      generatedAt: '2026-03-25T21:00:00.000Z',
      organs: [
        {
          modelProfileId: 'code.deep@shared',
          role: 'code',
          serviceId: 'vllm-deep',
          availability: 'available',
          quarantineState: 'clear',
          fallbackTargetProfileId: null,
          errorRate: 0,
          latencyMsP95: 125,
        },
      ],
    });
  } finally {
    await cleanup();
  }
});
