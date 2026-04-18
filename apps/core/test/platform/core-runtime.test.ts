import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCoreRuntime, loadCoreRuntimeConfig } from '../../src/platform/index.ts';

const createTempWorkspace = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-core-platform-'));

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
      'schemaVersion: "2026-03-19"',
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

void test('AC-F0002-01 loads the phase-0 runtime config from env and repo defaults', async () => {
  const root = await createTempWorkspace();

  try {
    const config = loadCoreRuntimeConfig({
      ...createConfigEnv(root),
      YAAGI_MIGRATIONS_DIR: path.join(root, 'infra/migrations'),
      YAAGI_PGBOSS_SCHEMA: 'pgboss',
      YAAGI_PORT: '8791',
      YAAGI_BOOT_TIMEOUT_MS: '3000',
    });

    assert.equal(config.postgresUrl, 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi');
    assert.equal(config.fastModelBaseUrl, 'http://127.0.0.1:8000/v1');
    assert.equal(
      config.fastModelDescriptorPath,
      path.join(root, 'seed/models/base/vllm-fast-manifest.json'),
    );
    assert.equal(config.deepModelBaseUrl, 'http://127.0.0.1:8001/v1');
    assert.equal(config.poolModelBaseUrl, 'http://127.0.0.1:8002/v1');
    assert.equal(config.port, 8791);
    assert.equal(config.bootTimeoutMs, 3000);
    assert.equal(config.pgBossSchema, 'pgboss');
    assert.equal(config.seedRootPath, path.join(root, 'seed'));
    assert.equal(
      config.seedConstitutionPath,
      path.join(root, 'seed/constitution/constitution.yaml'),
    );
    assert.equal(config.seedBodyPath, path.join(root, 'seed/body'));
    assert.equal(config.workspaceBodyPath, path.join(root, 'workspace/body'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0002-02 serves a minimal GET /health boundary with readiness state', async () => {
  const root = await createTempWorkspace();

  try {
    const runtime = createCoreRuntime(
      loadCoreRuntimeConfig({
        ...createConfigEnv(root),
        YAAGI_PORT: '8792',
      }),
      {
        bootstrapDatabase: () => Promise.resolve(),
        probeConfiguration: () => Promise.resolve(true),
        probePostgres: () => Promise.resolve(true),
        probeFastModel: () => Promise.resolve(true),
        createRuntimeLifecycle: () => ({
          start: () => Promise.resolve(),
          stop: () => Promise.resolve(),
        }),
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
        perception: {
          adapters: Array<{
            source: string;
            status: string;
          }>;
          backlog: {
            queued: number;
            claimed: number;
            consumed: number;
            dropped: number;
          };
        };
        checks: Array<{
          name: 'configuration' | 'postgres' | 'fastModel';
          ok: boolean;
        }>;
      };

      assert.equal(payload.ok, true);
      assert.equal(payload.postgres, true);
      assert.equal(payload.fastModel, true);
      assert.equal(payload.configuration, true);
      assert.deepEqual(payload.agents, ['phase0DecisionAgent']);
      assert.deepEqual(payload.checks, [
        { name: 'configuration', ok: true },
        { name: 'postgres', ok: true },
        { name: 'fastModel', ok: true },
      ]);
      assert.deepEqual(payload.perception.backlog, {
        queued: 0,
        claimed: 0,
        consumed: 0,
        dropped: 0,
      });
      assert.ok(
        payload.perception.adapters.some(
          (adapter) => adapter.source === 'http' && adapter.status === 'healthy',
        ),
      );
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0002-02 materializes writable runtime paths from seed before startup handoff', async () => {
  const root = await createTempWorkspace();
  const startupOrder: string[] = [];

  try {
    const runtime = createCoreRuntime(
      loadCoreRuntimeConfig({
        ...createConfigEnv(root),
        YAAGI_PORT: '8794',
      }),
      {
        bootstrapDatabase: () => Promise.resolve(),
        probePostgres: () => Promise.resolve(true),
        probeFastModel: () => Promise.resolve(true),
        createRuntimeLifecycle: () => ({
          start: () => {
            startupOrder.push('runtime');
            return Promise.resolve();
          },
          stop: () => Promise.resolve(),
        }),
      },
    );

    const started = await runtime.start();
    try {
      const materializedBodyKeep = await readFile(
        path.join(root, 'workspace/body/.gitkeep'),
        'utf8',
      );
      const materializedSkillsEntries = await readdir(path.join(root, 'workspace/skills'));
      const materializedModelKeep = await readFile(path.join(root, 'models/base/.gitkeep'), 'utf8');
      const materializedDatasetKeep = await readFile(
        path.join(root, 'data/datasets/.gitkeep'),
        'utf8',
      );

      assert.equal(materializedBodyKeep, '');
      assert.deepEqual(materializedSkillsEntries, []);
      assert.equal(materializedModelKeep, '');
      assert.equal(materializedDatasetKeep, '');
      assert.deepEqual(startupOrder, ['runtime']);

      const response = await fetch(`${started.url}/health`);
      assert.equal(response.status, 200);
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0002-02 keeps the phase-0 boundary health-only and surfaces dependency loss after startup', async () => {
  const root = await createTempWorkspace();
  let fastModelChecks = 0;

  try {
    const runtime = createCoreRuntime(
      loadCoreRuntimeConfig({
        ...createConfigEnv(root),
        YAAGI_PORT: '8793',
      }),
      {
        bootstrapDatabase: () => Promise.resolve(),
        probeConfiguration: () => Promise.resolve(true),
        probePostgres: () => Promise.resolve(true),
        probeFastModel: () => {
          fastModelChecks += 1;
          return Promise.resolve(fastModelChecks === 1);
        },
        createRuntimeLifecycle: () => ({
          start: () => Promise.resolve(),
          stop: () => Promise.resolve(),
        }),
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

void test('AC-F0005-02 exposes POST /ingest through the runtime boundary and returns canonical admission metadata', async () => {
  const root = await createTempWorkspace();

  try {
    const runtime = createCoreRuntime(
      loadCoreRuntimeConfig({
        ...createConfigEnv(root),
        YAAGI_PORT: '8795',
      }),
      {
        bootstrapDatabase: () => Promise.resolve(),
        probeConfiguration: () => Promise.resolve(true),
        probePostgres: () => Promise.resolve(true),
        probeFastModel: () => Promise.resolve(true),
        createRuntimeLifecycle: () => ({
          start: () => Promise.resolve(),
          stop: () => Promise.resolve(),
          ingestHttpStimulus: () =>
            Promise.resolve({
              stimulusId: 'stimulus-http-1',
              deduplicated: false,
              tickAdmission: {
                accepted: true,
              },
            }),
        }),
      },
    );

    const started = await runtime.start();
    try {
      const response = await fetch(`${started.url}/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          signalType: 'http.operator.message',
          payload: {
            text: 'hello',
          },
        }),
      });

      assert.equal(response.status, 202);
      assert.deepEqual(await response.json(), {
        accepted: true,
        stimulusId: 'stimulus-http-1',
        deduplicated: false,
        tickAdmission: {
          accepted: true,
        },
      });
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0020-05 / AC-F0020-06 / AC-F0020-10 / AC-F0020-12 preserves fail-closed promoted dependency admission metadata on POST /ingest', async () => {
  const root = await createTempWorkspace();

  try {
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
          ingestHttpStimulus: () =>
            Promise.resolve({
              stimulusId: 'stimulus-http-2',
              deduplicated: false,
              tickAdmission: {
                accepted: false,
                reason: 'promoted_dependency_unavailable',
              },
            }),
        }),
      },
    );

    const started = await runtime.start();
    try {
      const response = await fetch(`${started.url}/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          signalType: 'http.operator.message',
          payload: {
            text: 'hello',
          },
        }),
      });

      assert.equal(response.status, 202);
      assert.deepEqual(await response.json(), {
        accepted: true,
        stimulusId: 'stimulus-http-2',
        deduplicated: false,
        tickAdmission: {
          accepted: false,
          reason: 'promoted_dependency_unavailable',
        },
      });
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0005-02 returns 503 when the runtime ingest path fails after payload validation', async () => {
  const root = await createTempWorkspace();

  try {
    const runtime = createCoreRuntime(
      loadCoreRuntimeConfig({
        ...createConfigEnv(root),
        YAAGI_PORT: '8796',
      }),
      {
        bootstrapDatabase: () => Promise.resolve(),
        probeConfiguration: () => Promise.resolve(true),
        probePostgres: () => Promise.resolve(true),
        probeFastModel: () => Promise.resolve(true),
        createRuntimeLifecycle: () => ({
          start: () => Promise.resolve(),
          stop: () => Promise.resolve(),
          ingestHttpStimulus: () => Promise.reject(new Error('postgres unavailable')),
        }),
      },
    );

    const started = await runtime.start();
    try {
      const response = await fetch(`${started.url}/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          signalType: 'http.operator.message',
          payload: {
            text: 'hello',
          },
        }),
      });

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        accepted: false,
        error: 'postgres unavailable',
      });
    } finally {
      await runtime.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
