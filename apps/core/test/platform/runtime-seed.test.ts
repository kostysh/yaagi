import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadCoreRuntimeConfig } from '../../src/platform/core-config.ts';
import {
  materializeRuntimeSeed,
  syncRuntimeSkillsFromSeed,
} from '../../src/platform/runtime-seed.ts';

// Covers: AC-F0022-07, AC-F0022-08, AC-F0022-13, AC-F0022-14, AC-F0022-19

const createSeedFixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-runtime-seed-'));

  await mkdir(path.join(root, 'seed/body'), { recursive: true });
  await mkdir(path.join(root, 'seed/skills/demo-skill/references'), { recursive: true });
  await mkdir(path.join(root, 'seed/constitution'), { recursive: true });
  await mkdir(path.join(root, 'seed/models/base'), { recursive: true });
  await mkdir(path.join(root, 'seed/data/datasets'), { recursive: true });

  await writeFile(path.join(root, 'seed/body/seed-body.txt'), 'seed-body', 'utf8');
  await writeFile(
    path.join(root, 'seed/skills/demo-skill/SKILL.md'),
    '# Demo Skill\n\nSeed-backed runtime skill.\n',
    'utf8',
  );
  await writeFile(
    path.join(root, 'seed/skills/demo-skill/references/checklist.md'),
    '- seeded\n',
    'utf8',
  );
  await mkdir(path.join(root, 'seed/skills/broken-skill'), { recursive: true });
  await writeFile(path.join(root, 'seed/skills/broken-skill/README.md'), 'broken', 'utf8');
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
  await writeFile(path.join(root, 'seed/models/base/model.txt'), 'seed-model', 'utf8');
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
  await writeFile(path.join(root, 'seed/data/datasets/dataset.txt'), 'seed-dataset', 'utf8');

  return root;
};

void test('AC-F0002-05 materializes empty runtime volumes from seed and preserves live runtime state on reuse', async () => {
  const root = await createSeedFixture();

  try {
    const config = loadCoreRuntimeConfig({
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
      YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
      YAAGI_DATA_PATH: path.join(root, 'data'),
    });

    await mkdir(path.join(root, 'workspace/body'), { recursive: true });
    await mkdir(path.join(root, 'workspace/skills'), { recursive: true });
    await mkdir(path.join(root, 'models/base'), { recursive: true });
    await mkdir(path.join(root, 'models/adapters'), { recursive: true });
    await mkdir(path.join(root, 'models/specialists'), { recursive: true });
    await mkdir(path.join(root, 'data/datasets'), { recursive: true });
    await mkdir(path.join(root, 'data/reports'), { recursive: true });
    await mkdir(path.join(root, 'data/snapshots'), { recursive: true });

    const firstPass = await materializeRuntimeSeed(config);
    assert.deepEqual(firstPass, {
      body: 'seeded',
      skills: 'seeded',
      models: 'seeded',
      data: 'seeded',
    });
    assert.equal(
      await readFile(path.join(root, 'workspace/body/seed-body.txt'), 'utf8'),
      'seed-body',
    );
    assert.equal(
      await readFile(path.join(root, 'workspace/skills/demo-skill/SKILL.md'), 'utf8'),
      '# Demo Skill\n\nSeed-backed runtime skill.\n',
    );
    await assert.rejects(readFile(path.join(root, 'workspace/skills/broken-skill/README.md')));
    assert.equal(await readFile(path.join(root, 'models/base/model.txt'), 'utf8'), 'seed-model');
    assert.match(
      await readFile(path.join(root, 'models/base/vllm-fast-manifest.json'), 'utf8'),
      /"serviceId": "vllm-fast"/,
    );
    assert.equal(
      await readFile(path.join(root, 'data/datasets/dataset.txt'), 'utf8'),
      'seed-dataset',
    );

    await writeFile(path.join(root, 'workspace/body/live-runtime.txt'), 'runtime', 'utf8');
    await writeFile(path.join(root, 'seed/body/seed-body-2.txt'), 'seed-body-2', 'utf8');

    const secondPass = await materializeRuntimeSeed(config);
    assert.deepEqual(secondPass, {
      body: 'reused',
      skills: 'reused',
      models: 'reused',
      data: 'reused',
    });
    assert.equal(
      await readFile(path.join(root, 'workspace/body/live-runtime.txt'), 'utf8'),
      'runtime',
    );
    await assert.rejects(readFile(path.join(root, 'workspace/body/seed-body-2.txt'), 'utf8'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0022-19 explicit skill sync replaces stale workspace skills from the canonical seed tree', async () => {
  const root = await createSeedFixture();

  try {
    const config = loadCoreRuntimeConfig({
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
      YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
      YAAGI_DATA_PATH: path.join(root, 'data'),
    });

    await mkdir(path.join(root, 'workspace/skills/stale-skill'), { recursive: true });
    await writeFile(path.join(root, 'workspace/skills/stale-skill/SKILL.md'), '# stale\n', 'utf8');

    await syncRuntimeSkillsFromSeed(config);

    assert.equal(
      await readFile(path.join(root, 'workspace/skills/demo-skill/SKILL.md'), 'utf8'),
      '# Demo Skill\n\nSeed-backed runtime skill.\n',
    );
    await assert.rejects(
      readFile(path.join(root, 'workspace/skills/broken-skill/README.md'), 'utf8'),
    );
    await assert.rejects(
      readFile(path.join(root, 'workspace/skills/stale-skill/SKILL.md'), 'utf8'),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0022-14 rejects skill sync when the configured runtime path traverses a symlinked segment', async () => {
  const root = await createSeedFixture();

  try {
    await mkdir(path.join(root, 'outside-runtime'), { recursive: true });
    await symlink(path.join(root, 'outside-runtime'), path.join(root, 'workspace-link'));

    const config = loadCoreRuntimeConfig({
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
      YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace-link/skills'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
      YAAGI_DATA_PATH: path.join(root, 'data'),
    });

    await assert.rejects(syncRuntimeSkillsFromSeed(config), /symlinked segment/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0002-04 rejects runtime paths that collapse back under the tracked seed boundary', async () => {
  const root = await createSeedFixture();

  try {
    const config = loadCoreRuntimeConfig({
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'seed/runtime-body'),
      YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
      YAAGI_DATA_PATH: path.join(root, 'data'),
    });

    await assert.rejects(
      materializeRuntimeSeed(config),
      /must stay outside the tracked seed boundary/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0002-06 treats hidden or unreadable runtime cache trees as live runtime state instead of placeholder seed directories', async () => {
  const root = await createSeedFixture();

  try {
    const config = loadCoreRuntimeConfig({
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
      YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
      YAAGI_DATA_PATH: path.join(root, 'data'),
    });

    await mkdir(path.join(root, 'workspace/body'), { recursive: true });
    await mkdir(path.join(root, 'workspace/skills'), { recursive: true });
    await mkdir(path.join(root, 'models/base'), { recursive: true });
    await mkdir(path.join(root, 'models/adapters'), { recursive: true });
    await mkdir(path.join(root, 'models/specialists'), { recursive: true });
    await mkdir(path.join(root, 'data/datasets'), { recursive: true });
    await mkdir(path.join(root, 'data/reports'), { recursive: true });
    await mkdir(path.join(root, 'data/snapshots'), { recursive: true });

    await materializeRuntimeSeed(config);

    const hiddenCacheRoot = path.join(root, 'models/.cache/comgr');
    await mkdir(hiddenCacheRoot, { recursive: true });
    await writeFile(path.join(hiddenCacheRoot, 'artifact.bin'), 'cache', 'utf8');
    await chmod(hiddenCacheRoot, 0o000);

    try {
      const secondPass = await materializeRuntimeSeed(config);
      assert.equal(secondPass.models, 'reused');
    } finally {
      await chmod(hiddenCacheRoot, 0o755);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
