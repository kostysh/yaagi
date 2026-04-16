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
        schemaVersion: '2026-04-16',
        serviceId: 'vllm-fast',
        selectionState: 'qualification_pending',
        protocol: 'openai-compatible',
        preferredCandidateId: 'gemma-4-e4b-it',
        runtimeArtifactRoot: 'base/vllm-fast',
        mustPassGates: ['canonical_container_boot'],
        scorecard: [
          { name: 'quality', weight: 40 },
          { name: 'latency_throughput', weight: 25 },
          { name: 'memory_headroom', weight: 20 },
          { name: 'stability_restart', weight: 15 },
        ],
        candidates: [
          {
            candidateId: 'gemma-4-e4b-it',
            modelId: 'google/gemma-4-E4B-it',
            sourceUri: 'hf://google/gemma-4-E4B-it',
            selectionRole: 'preferred',
            runtimeSubdir: 'base/vllm-fast/google--gemma-4-E4B-it',
          },
          {
            candidateId: 'phi-4-mini-instruct',
            modelId: 'microsoft/Phi-4-mini-instruct',
            sourceUri: 'hf://microsoft/Phi-4-mini-instruct',
            selectionRole: 'fallback',
            runtimeSubdir: 'base/vllm-fast/microsoft--Phi-4-mini-instruct',
          },
          {
            candidateId: 'qwen3-8b',
            modelId: 'Qwen/Qwen3-8B',
            sourceUri: 'hf://Qwen/Qwen3-8B',
            selectionRole: 'comparator',
            runtimeSubdir: 'base/vllm-fast/Qwen--Qwen3-8B',
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

void test('AC-F0008-06 surfaces baseline profile diagnostics through health and the bounded operator /models projection', async () => {
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
                endpoint: 'http://vllm-fast:8000/v1',
                artifactUri: 'file:///seed/models/base/vllm-fast-manifest.json',
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

      const modelsResponse = await fetch(`${started.url}/models`);
      assert.equal(modelsResponse.status, 200);

      const modelsPayload = (await modelsResponse.json()) as {
        baselineProfiles: Array<{
          modelProfileId: string;
          role: string;
          status: string;
          adapterOf: string | null;
          artifactUri: string | null;
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
      assert.deepEqual(modelsPayload.baselineProfiles, [
        {
          modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
          role: 'reflex',
          status: 'active',
          adapterOf: null,
          artifactUri: 'file:///seed/models/base/vllm-fast-manifest.json',
          baseModel: 'model-fast',
          healthSummary: {
            healthy: true,
            detail: 'model-fast dependency is reachable',
          },
        },
      ]);
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
