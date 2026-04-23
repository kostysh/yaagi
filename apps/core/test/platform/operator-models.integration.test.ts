import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASE0_BASELINE_PROFILE_ID } from '../../src/runtime/index.ts';
import {
  createOperatorAuthHeaders,
  createPlatformTestRuntime,
} from '../../testing/platform-test-fixture.ts';

void test('AC-F0013-04 / AC-F0020-02 / AC-F0020-04 returns bounded baseline model diagnostics and the F-0014 richer registry projection', async () => {
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
              serviceId: 'vllm-fast',
              endpoint: 'http://vllm-fast:8000/v1',
              artifactUri: 'file:///seed/models/base/vllm-fast-manifest.json',
              baseModel: 'model-fast',
              adapterOf: null,
              artifactDescriptorPath: '/seed/models/base/vllm-fast-manifest.json',
              runtimeArtifactRoot: '/models/base/vllm-fast',
              bootCritical: true,
              optionalUntilPromoted: false,
              readiness: 'ready',
              readinessBasis: 'probe_passed',
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
        getServingDependencyStates: () =>
          Promise.resolve([
            {
              serviceId: 'vllm-fast',
              endpoint: 'http://vllm-fast:8000/v1',
              bootCritical: true,
              optionalUntilPromoted: false,
              artifactUri: 'file:///seed/models/base/vllm-fast-manifest.json',
              artifactDescriptorPath: '/seed/models/base/vllm-fast-manifest.json',
              runtimeArtifactRoot: '/models/base/vllm-fast',
              readiness: 'ready',
              readinessBasis: 'probe_passed',
              candidateId: 'gemma-4-e4b-it',
              baseModel: 'google/gemma-4-E4B-it',
              servedModelName: 'phase-0-fast',
              detail: 'fast dependency is ready',
              lastCheckedAt: '2026-03-25T21:00:00.000Z',
            },
          ]),
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
      baselineProfiles: Array<{
        modelProfileId: string;
        role: string;
        serviceId: string;
        status: string;
        adapterOf: string | null;
        artifactUri: string | null;
        baseModel: string;
        artifactDescriptorPath: string | null;
        runtimeArtifactRoot: string | null;
        bootCritical: boolean;
        optionalUntilPromoted: boolean;
        readiness: string;
        readinessBasis: string | null;
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
      servingDependencies: Array<{
        serviceId: string;
        readiness: string;
        readinessBasis: string;
        servedModelName: string | null;
      }>;
    };

    assert.deepEqual(payload.baselineProfiles, [
      {
        modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
        role: 'reflex',
        serviceId: 'vllm-fast',
        status: 'active',
        adapterOf: null,
        artifactUri: null,
        baseModel: 'model-fast',
        artifactDescriptorPath: null,
        runtimeArtifactRoot: null,
        bootCritical: true,
        optionalUntilPromoted: false,
        readiness: 'ready',
        readinessBasis: 'probe_passed',
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
    assert.deepEqual(
      payload.servingDependencies.map((dependency) => ({
        serviceId: dependency.serviceId,
        readiness: dependency.readiness,
        readinessBasis: dependency.readinessBasis,
        servedModelName: dependency.servedModelName,
      })),
      [
        {
          serviceId: 'vllm-fast',
          readiness: 'ready',
          readinessBasis: 'probe_passed',
          servedModelName: null,
        },
      ],
    );
  } finally {
    await cleanup();
  }
});
