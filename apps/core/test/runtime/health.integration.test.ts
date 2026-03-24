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

void test('AC-F0008-06 surfaces baseline profile diagnostics without opening a models API', async () => {
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
      assert.equal(modelsResponse.status, 404);
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
