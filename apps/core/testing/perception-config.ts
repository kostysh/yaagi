import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CoreRuntimeConfig } from '../src/platform/core-config.ts';

export async function createPerceptionTestWorkspace(): Promise<{
  root: string;
  cleanup(): Promise<void>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-perception-'));
  const directories = [
    'seed/body',
    'seed/skills',
    'seed/constitution',
    'seed/models/base',
    'seed/data/datasets',
    'seed/data/reports',
    'seed/data/snapshots',
    'workspace/body',
    'workspace/skills',
    'models',
    'data/datasets',
    'data/reports',
    'data/snapshots',
  ];

  for (const directory of directories) {
    await mkdir(path.join(root, directory), { recursive: true });
  }

  await writeFile(path.join(root, 'seed/constitution/constitution.yaml'), 'version: "1.0.0"\n');
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

  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export function buildPerceptionTestConfig(
  root: string,
  overrides: Partial<CoreRuntimeConfig> = {},
): CoreRuntimeConfig {
  return {
    postgresUrl: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
    fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
    deepModelBaseUrl: 'http://127.0.0.1:8001/v1',
    poolModelBaseUrl: 'http://127.0.0.1:8002/v1',
    telegramEnabled: false,
    telegramBotToken: null,
    telegramAllowedChatIds: [],
    telegramApiBaseUrl: 'https://api.telegram.org',
    seedRootPath: path.join(root, 'seed'),
    seedConstitutionPath: path.join(root, 'seed/constitution/constitution.yaml'),
    seedBodyPath: path.join(root, 'seed/body'),
    seedSkillsPath: path.join(root, 'seed/skills'),
    seedModelsPath: path.join(root, 'seed/models'),
    seedDataPath: path.join(root, 'seed/data'),
    workspaceBodyPath: path.join(root, 'workspace/body'),
    workspaceSkillsPath: path.join(root, 'workspace/skills'),
    modelsPath: path.join(root, 'models'),
    dataPath: path.join(root, 'data'),
    migrationsDir: path.join(root, 'infra/migrations'),
    pgBossSchema: 'pgboss',
    host: '127.0.0.1',
    port: 8787,
    bootTimeoutMs: 60_000,
    ...overrides,
    fastModelDescriptorPath:
      overrides.fastModelDescriptorPath ??
      path.join(root, 'seed/models/base/vllm-fast-manifest.json'),
  };
}
