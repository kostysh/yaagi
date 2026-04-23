import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOperatorAuthHeaders,
  createPlatformTestRuntime,
} from '../../testing/platform-test-fixture.ts';

void test('AC-F0014-06 richer model ecology stays separate from operator publication, CF-015 reporting, homeostat consumption and specialist lifecycle policy', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        getModelRoutingDiagnostics: () => Promise.resolve([]),
        getRicherModelRegistryHealthSummary: () =>
          Promise.resolve({
            available: true,
            owner: 'F-0014' as const,
            generatedAt: '2026-03-25T20:30:00.000Z',
            organs: [
              {
                modelProfileId: 'code.deep@shared',
                role: 'code' as const,
                serviceId: 'vllm-deep',
                availability: 'available' as const,
                quarantineState: 'clear' as const,
                fallbackTargetProfileId: null,
                errorRate: 0,
                latencyMsP95: 140,
              },
            ],
          }),
      }),
    },
  });

  try {
    const response = await runtime.fetch(
      new Request('http://yaagi/models', {
        headers: createOperatorAuthHeaders('operator'),
      }),
    );
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      baselineProfiles: unknown[];
      richerRegistryHealth: Record<string, unknown>;
    };

    assert.deepEqual(payload.baselineProfiles, []);
    assert.deepEqual(payload.richerRegistryHealth, {
      available: true,
      owner: 'F-0014',
      generatedAt: '2026-03-25T20:30:00.000Z',
      organs: [
        {
          modelProfileId: 'code.deep@shared',
          role: 'code',
          serviceId: 'vllm-deep',
          availability: 'available',
          quarantineState: 'clear',
          fallbackTargetProfileId: null,
          errorRate: 0,
          latencyMsP95: 140,
        },
      ],
    });
    assert.equal('profiles' in payload.richerRegistryHealth, false);
    assert.equal('sourceJson' in payload.richerRegistryHealth, false);
  } finally {
    await cleanup();
  }
});
