import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCoreRuntime, loadCoreRuntimeConfig } from '../../src/platform/index.ts';

const createTempWorkspace = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-core-platform-'));
  await mkdir(path.join(root, 'workspace/body'), { recursive: true });
  await mkdir(path.join(root, 'workspace/skills'), { recursive: true });
  await mkdir(path.join(root, 'workspace/constitution'), { recursive: true });
  await mkdir(path.join(root, 'models'), { recursive: true });
  await mkdir(path.join(root, 'data'), { recursive: true });
  await writeFile(
    path.join(root, 'workspace/constitution/constitution.yaml'),
    [
      'version: "1.0.0"',
      'schemaVersion: "2026-03-19"',
      'requiredVolumes:',
      '  - workspace/body',
      '  - workspace/skills',
      '  - workspace/constitution',
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

test('AC-F0002-01 loads the phase-0 runtime config from env and repo defaults', async () => {
  const root = await createTempWorkspace();

  try {
    const config = loadCoreRuntimeConfig({
      YAAGI_POSTGRES_URL: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
      YAAGI_FAST_MODEL_BASE_URL: 'http://127.0.0.1:8000/v1',
      YAAGI_CONSTITUTION_PATH: path.join(root, 'workspace/constitution/constitution.yaml'),
      YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
      YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
      YAAGI_DATA_PATH: path.join(root, 'data'),
      YAAGI_MIGRATIONS_DIR: path.join(root, 'infra/migrations'),
      YAAGI_PGBOSS_SCHEMA: 'pgboss',
      YAAGI_HOST: '127.0.0.1',
      YAAGI_PORT: '8791',
      YAAGI_BOOT_TIMEOUT_MS: '3000',
    });

    assert.equal(config.postgresUrl, 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi');
    assert.equal(config.fastModelBaseUrl, 'http://127.0.0.1:8000/v1');
    assert.equal(config.port, 8791);
    assert.equal(config.bootTimeoutMs, 3000);
    assert.equal(config.pgBossSchema, 'pgboss');
    assert.equal(
      config.constitutionPath,
      path.join(root, 'workspace/constitution/constitution.yaml'),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('AC-F0002-02 serves a minimal GET /health boundary with readiness state', async () => {
  const root = await createTempWorkspace();

  try {
    const runtime = createCoreRuntime(
      loadCoreRuntimeConfig({
        YAAGI_POSTGRES_URL: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
        YAAGI_FAST_MODEL_BASE_URL: 'http://127.0.0.1:8000/v1',
        YAAGI_CONSTITUTION_PATH: path.join(root, 'workspace/constitution/constitution.yaml'),
        YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
        YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
        YAAGI_MODELS_PATH: path.join(root, 'models'),
        YAAGI_DATA_PATH: path.join(root, 'data'),
        YAAGI_HOST: '127.0.0.1',
        YAAGI_PORT: '8792',
      }),
      {
        bootstrapDatabase: async () => {},
        probeConfiguration: async () => true,
        probePostgres: async () => true,
        probeFastModel: async () => true,
      },
    );

    const started = await runtime.start();
    try {
      const response = await fetch(`${started.url}/health`);
      assert.equal(response.status, 200);

      const payload = (await response.json()) as {
        ok: boolean;
        postgres: boolean;
        fastModel: boolean;
        configuration: boolean;
        agents: string[];
        checks: Array<{
          name: 'configuration' | 'postgres' | 'fastModel';
          ok: boolean;
        }>;
      };

      assert.deepEqual(payload, {
        ok: true,
        postgres: true,
        fastModel: true,
        configuration: true,
        agents: ['phase0DecisionAgent'],
        checks: [
          { name: 'configuration', ok: true },
          { name: 'postgres', ok: true },
          { name: 'fastModel', ok: true },
        ],
      });
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('AC-F0002-02 keeps the phase-0 boundary health-only and surfaces dependency loss after startup', async () => {
  const root = await createTempWorkspace();
  let fastModelChecks = 0;

  try {
    const runtime = createCoreRuntime(
      loadCoreRuntimeConfig({
        YAAGI_POSTGRES_URL: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
        YAAGI_FAST_MODEL_BASE_URL: 'http://127.0.0.1:8000/v1',
        YAAGI_CONSTITUTION_PATH: path.join(root, 'workspace/constitution/constitution.yaml'),
        YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
        YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
        YAAGI_MODELS_PATH: path.join(root, 'models'),
        YAAGI_DATA_PATH: path.join(root, 'data'),
        YAAGI_HOST: '127.0.0.1',
        YAAGI_PORT: '8793',
      }),
      {
        bootstrapDatabase: async () => {},
        probeConfiguration: async () => true,
        probePostgres: async () => true,
        probeFastModel: async () => {
          fastModelChecks += 1;
          return fastModelChecks === 1;
        },
      },
    );

    const started = await runtime.start();
    try {
      const response = await fetch(`${started.url}/health`);
      assert.equal(response.status, 503);

      const unknownRoute = await fetch(`${started.url}/state`);
      assert.equal(unknownRoute.status, 404);
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
