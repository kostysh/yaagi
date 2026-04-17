import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createCoreRuntime,
  loadCoreRuntimeConfig,
  type CoreRuntime,
  type CoreRuntimeDependencies,
} from '../src/platform/index.ts';

export const createPlatformTempWorkspace = async (
  prefix = 'yaagi-operator-api-',
): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));

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
      'schemaVersion: "2026-03-25"',
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

export const createPlatformConfigEnv = (root: string): NodeJS.ProcessEnv => ({
  YAAGI_POSTGRES_URL: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
  YAAGI_FAST_MODEL_BASE_URL: 'http://127.0.0.1:8000/v1',
  YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
  YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
  YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
  YAAGI_MODELS_PATH: path.join(root, 'models'),
  YAAGI_DATA_PATH: path.join(root, 'data'),
  YAAGI_HOST: '127.0.0.1',
});

export async function createPlatformTestRuntime(
  options: { port?: number; prefix?: string; dependencies?: CoreRuntimeDependencies } = {},
): Promise<{
  root: string;
  runtime: CoreRuntime;
  cleanup: () => Promise<void>;
}> {
  const root = await createPlatformTempWorkspace(options.prefix);
  const runtime = createCoreRuntime(
    loadCoreRuntimeConfig({
      ...createPlatformConfigEnv(root),
      YAAGI_PORT: String(options.port ?? 8890),
    }),
    {
      bootstrapDatabase: () => Promise.resolve(),
      probeConfiguration: () => Promise.resolve(true),
      probePostgres: () => Promise.resolve(true),
      probeFastModel: () => Promise.resolve(true),
      ...options.dependencies,
    },
  );

  return {
    root,
    runtime,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
