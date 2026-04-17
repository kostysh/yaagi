import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCoreRuntime, loadCoreRuntimeConfig } from '../../src/platform/index.ts';
import { PHASE0_BASELINE_PROFILE_ID } from '../../src/runtime/index.ts';

const createTempWorkspace = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-f0008-health-'));

  await mkdir(path.join(root, 'seed/body'), { recursive: true });
  await mkdir(path.join(root, 'seed/skills'), { recursive: true });
  await mkdir(path.join(root, 'seed/constitution'), { recursive: true });
  await mkdir(path.join(root, 'seed/models/base'), { recursive: true });
  await mkdir(path.join(root, 'seed/models/adapters'), { recursive: true });
  await mkdir(path.join(root, 'seed/models/specialists'), { recursive: true });
  await mkdir(path.join(root, 'seed/data/datasets'), { recursive: true });
  await mkdir(path.join(root, 'seed/data/reports'), { recursive: true });
  await mkdir(path.join(root, 'seed/data/snapshots'), { recursive: true });

  await writeFile(path.join(root, 'seed/body/.gitkeep'), '', 'utf8');
  await writeFile(path.join(root, 'seed/skills/.gitkeep'), '', 'utf8');
  await writeFile(path.join(root, 'seed/models/base/.gitkeep'), '', 'utf8');
  await writeFile(
    path.join(root, 'seed/models/base/vllm-fast-manifest.json'),
    JSON.stringify(
      {
        schemaVersion: '2026-04-17',
        serviceId: 'vllm-fast',
        selectionState: 'qualified',
        protocol: 'openai-compatible',
        preferredCandidateId: 'gemma-4-e4b-it',
        selectedCandidateId: 'gemma-4-e4b-it',
        runtimeArtifactRoot: 'base/vllm-fast',
        qualificationCorpusPath: 'seed/models/base/vllm-fast-qualification-corpus.json',
        qualificationReportPath: 'base/vllm-fast/qualification/latest.json',
        mustPassGates: [
          'canonical_container_boot',
          'real_inference_probe',
          'cold_start_stability',
          'warm_probe_stability',
          'structured_output_threshold',
          'descriptor_to_runtime_trace',
        ],
        scorecard: [
          { name: 'quality', weight: 40 },
          { name: 'latency_throughput', weight: 25 },
          { name: 'memory_headroom', weight: 20 },
          { name: 'stability_restart', weight: 15 },
        ],
        servingConfig: {
          servedModelName: 'phase-0-fast',
          dtype: 'bfloat16',
          tensorParallelSize: 1,
          maxModelLen: 16384,
          gpuMemoryUtilization: 0.82,
          maxNumSeqs: 4,
          generationConfig: 'vllm',
          attentionBackend: 'TRITON_ATTN',
          limitMmPerPrompt: '{"image":0,"audio":0}',
        },
        readinessProbe: {
          prompt: 'Reply with the single word READY.',
          expectedText: 'READY',
          maxTokens: 8,
          timeoutMs: 15000,
        },
        candidates: [
          {
            candidateId: 'gemma-4-e4b-it',
            modelId: 'google/gemma-4-E4B-it',
            sourceUri: 'hf://google/gemma-4-E4B-it',
            selectionRole: 'preferred',
            runtimeSubdir: 'base/vllm-fast/google--gemma-4-E4B-it',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(path.join(root, 'seed/models/adapters/.gitkeep'), '', 'utf8');
  await writeFile(path.join(root, 'seed/models/specialists/.gitkeep'), '', 'utf8');
  await writeFile(path.join(root, 'seed/data/datasets/.gitkeep'), '', 'utf8');
  await writeFile(path.join(root, 'seed/data/reports/.gitkeep'), '', 'utf8');
  await writeFile(path.join(root, 'seed/data/snapshots/.gitkeep'), '', 'utf8');
  await writeFile(
    path.join(root, 'seed/constitution/constitution.yaml'),
    [
      'version: "1.0.0"',
      'schemaVersion: "2026-03-24"',
      'requiredVolumes:',
      '  - seed/body',
      '  - seed/skills',
      '  - seed/constitution',
      '  - seed/models',
      '  - seed/data',
      '  - workspace/body',
      '  - workspace/skills',
      '  - models',
      '  - data',
      'requiredDependencies:',
      '  - postgres',
      '  - model-fast',
      'allowedDegradedDependencies:',
      '  - vllm-deep',
      '  - vllm-pool',
      '',
    ].join('\n'),
    'utf8',
  );

  return root;
};

const createConfigEnv = (root: string): NodeJS.ProcessEnv => ({
  YAAGI_POSTGRES_URL: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
  YAAGI_FAST_MODEL_BASE_URL: 'http://127.0.0.1:8000/v1',
  YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
  YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
  YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
  YAAGI_MODELS_PATH: path.join(root, 'models'),
  YAAGI_DATA_PATH: path.join(root, 'data'),
  YAAGI_HOST: '127.0.0.1',
});

void test('AC-F0008-06 / AC-F0020-02 / AC-F0020-04 surfaces baseline profile diagnostics through health and the bounded operator /models projection', async () => {
  const root = await createTempWorkspace();

  try {
    const runtime = createCoreRuntime(
      loadCoreRuntimeConfig({
        ...createConfigEnv(root),
        YAAGI_PORT: '8797',
      }),
      {
        bootstrapDatabase: () => Promise.resolve(),
        probeConfiguration: () => Promise.resolve(true),
        probePostgres: () => Promise.resolve(true),
        probeFastModel: () => Promise.resolve(true),
        createRuntimeLifecycle: () => ({
          start: () => Promise.resolve(),
          stop: () => Promise.resolve(),
          health: () =>
            Promise.resolve({
              adapters: [],
              backlog: {
                queued: 0,
                claimed: 0,
                consumed: 0,
                dropped: 0,
              },
            }),
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
              generatedAt: '2026-03-25T21:05:00.000Z',
              organs: [
                {
                  modelProfileId: 'embedding.pool@shared',
                  role: 'embedding' as const,
                  serviceId: 'vllm-pool',
                  availability: 'degraded' as const,
                  quarantineState: 'active' as const,
                  fallbackTargetProfileId: null,
                  errorRate: 0.45,
                  latencyMsP95: 255,
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
                lastCheckedAt: '2026-03-25T21:05:00.000Z',
              },
            ]),
          peekServingDependencyStates: () => [
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
              lastCheckedAt: '2026-03-25T21:05:00.000Z',
            },
          ],
        }),
      },
    );

    const started = await runtime.start();
    try {
      const healthResponse = await fetch(`${started.url}/health`);
      assert.equal(healthResponse.status, 200);

      const healthPayload = (await healthResponse.json()) as {
        modelRouting: {
          profiles: Array<{
            modelProfileId: string;
            role: string;
            status: string;
            eligibility: string;
            healthSummary: {
              healthy: boolean;
              detail?: string;
            };
          }>;
        };
        servingDependencies: Array<{
          serviceId: string;
          readiness: string;
          readinessBasis: string;
        }>;
      };

      assert.deepEqual(
        healthPayload.modelRouting.profiles.map((profile) => ({
          modelProfileId: profile.modelProfileId,
          role: profile.role,
          status: profile.status,
          eligibility: profile.eligibility,
          healthSummary: profile.healthSummary,
        })),
        [
          {
            modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
            role: 'reflex',
            status: 'active',
            eligibility: 'eligible',
            healthSummary: {
              healthy: true,
              detail: 'model-fast dependency is reachable',
            },
          },
        ],
      );
      assert.deepEqual(
        healthPayload.servingDependencies.map((dependency) => ({
          serviceId: dependency.serviceId,
          readiness: dependency.readiness,
          readinessBasis: dependency.readinessBasis,
        })),
        [
          {
            serviceId: 'vllm-fast',
            readiness: 'ready',
            readinessBasis: 'probe_passed',
          },
        ],
      );

      const modelsResponse = await fetch(`${started.url}/models`);
      assert.equal(modelsResponse.status, 200);

      const modelsPayload = (await modelsResponse.json()) as {
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
        }>;
      };
      assert.deepEqual(modelsPayload.baselineProfiles, [
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
      assert.deepEqual(
        modelsPayload.servingDependencies.map((dependency) => ({
          serviceId: dependency.serviceId,
          readiness: dependency.readiness,
        })),
        [
          {
            serviceId: 'vllm-fast',
            readiness: 'ready',
          },
        ],
      );
      assert.deepEqual(modelsPayload.richerRegistryHealth, {
        available: true,
        owner: 'F-0014',
        generatedAt: '2026-03-25T21:05:00.000Z',
        organs: [
          {
            modelProfileId: 'embedding.pool@shared',
            role: 'embedding',
            serviceId: 'vllm-pool',
            availability: 'degraded',
            quarantineState: 'active',
            fallbackTargetProfileId: null,
            errorRate: 0.45,
            latencyMsP95: 255,
          },
        ],
      });
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0020-04 prefers fresh serving dependency truth over stale peek state on public health surfaces', async () => {
  const root = await createTempWorkspace();

  try {
    const staleReady = {
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
      detail: 'stale ready state',
      lastCheckedAt: '2026-03-25T21:05:00.000Z',
    } as const;
    const freshUnavailable = {
      ...staleReady,
      readiness: 'unavailable',
      readinessBasis: 'transport_failed',
      detail: 'fresh probe failed after dependency loss',
    } as const;

    const runtime = createCoreRuntime(
      loadCoreRuntimeConfig({
        ...createConfigEnv(root),
        YAAGI_PORT: '8798',
      }),
      {
        bootstrapDatabase: () => Promise.resolve(),
        probeConfiguration: () => Promise.resolve(true),
        probePostgres: () => Promise.resolve(true),
        probeFastModel: () => Promise.resolve(true),
        createRuntimeLifecycle: () => ({
          start: () => Promise.resolve(),
          stop: () => Promise.resolve(),
          health: () =>
            Promise.resolve({
              adapters: [],
              backlog: {
                queued: 0,
                claimed: 0,
                consumed: 0,
                dropped: 0,
              },
            }),
          getModelRoutingDiagnostics: () =>
            Promise.resolve([
              {
                modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
                role: 'reflex',
                serviceId: 'vllm-fast',
                endpoint: staleReady.endpoint,
                artifactUri: staleReady.artifactUri,
                baseModel: 'model-fast',
                adapterOf: null,
                artifactDescriptorPath: staleReady.artifactDescriptorPath,
                runtimeArtifactRoot: staleReady.runtimeArtifactRoot,
                bootCritical: true,
                optionalUntilPromoted: false,
                readiness: freshUnavailable.readiness,
                readinessBasis: freshUnavailable.readinessBasis,
                capabilities: ['reactive'],
                status: 'active',
                eligibility: 'profile_unhealthy',
                healthSummary: {
                  healthy: false,
                  detail: freshUnavailable.detail,
                },
              },
            ]),
          getServingDependencyStates: () => Promise.resolve([freshUnavailable]),
          peekServingDependencyStates: () => [staleReady],
        }),
      },
    );

    const started = await runtime.start();
    try {
      const healthResponse = await fetch(`${started.url}/health`);
      assert.equal(healthResponse.status, 503);

      const healthPayload = (await healthResponse.json()) as {
        fastModel: boolean;
        servingDependencies: Array<{
          serviceId: string;
          readiness: string;
          readinessBasis: string;
        }>;
      };
      assert.equal(healthPayload.fastModel, false);
      assert.deepEqual(
        healthPayload.servingDependencies.map((dependency) => ({
          serviceId: dependency.serviceId,
          readiness: dependency.readiness,
          readinessBasis: dependency.readinessBasis,
        })),
        [
          {
            serviceId: 'vllm-fast',
            readiness: 'unavailable',
            readinessBasis: 'transport_failed',
          },
        ],
      );

      const modelsResponse = await fetch(`${started.url}/models`);
      assert.equal(modelsResponse.status, 200);
      const modelsPayload = (await modelsResponse.json()) as {
        servingDependencies: Array<{
          serviceId: string;
          readiness: string;
          readinessBasis: string;
        }>;
      };
      assert.deepEqual(
        modelsPayload.servingDependencies.map((dependency) => ({
          serviceId: dependency.serviceId,
          readiness: dependency.readiness,
          readinessBasis: dependency.readinessBasis,
        })),
        [
          {
            serviceId: 'vllm-fast',
            readiness: 'unavailable',
            readinessBasis: 'transport_failed',
          },
        ],
      );
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
