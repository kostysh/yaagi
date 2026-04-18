import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadCoreRuntimeConfig } from '../../src/platform/core-config.ts';
import { materializeRuntimeSeed } from '../../src/platform/runtime-seed.ts';
import { createRuntimeSkillsService } from '../../src/runtime/skills-runtime.ts';

// Covers: AC-F0022-09, AC-F0022-10, AC-F0022-11, AC-F0022-12, AC-F0022-14, AC-F0022-15, AC-F0022-18, AC-F0022-19, AC-F0022-20, AC-F0022-23, AC-F0022-24, AC-F0022-25, AC-F0022-26, AC-F0022-27, NFR-F0022-02

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 5_000,
  intervalMs = 50,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('condition was not met before timeout');
};

const createRuntimeFixture = async (): Promise<{
  root: string;
  config: ReturnType<typeof loadCoreRuntimeConfig>;
}> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-skills-runtime-'));

  await mkdir(path.join(root, 'seed/body'), { recursive: true });
  await mkdir(path.join(root, 'seed/skills/demo-skill/references'), { recursive: true });
  await mkdir(path.join(root, 'seed/constitution'), { recursive: true });
  await mkdir(path.join(root, 'seed/models/base'), { recursive: true });
  await mkdir(path.join(root, 'seed/data/datasets'), { recursive: true });

  await writeFile(path.join(root, 'seed/body/.gitkeep'), '', 'utf8');
  await writeFile(
    path.join(root, 'seed/skills/demo-skill/SKILL.md'),
    '# Demo Skill\n\nThis skill proves runtime loading.\n',
    'utf8',
  );
  await writeFile(
    path.join(root, 'seed/skills/demo-skill/references/checklist.md'),
    '- valid\n- loaded\n',
    'utf8',
  );
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
  await writeFile(
    path.join(root, 'seed/models/base/vllm-fast-manifest.json'),
    JSON.stringify({
      schemaVersion: '2026-04-17',
      serviceId: 'vllm-fast',
      selectionState: 'qualified',
      protocol: 'openai-compatible',
      preferredCandidateId: 'gemma-4-e4b-it',
      selectedCandidateId: 'gemma-4-e4b-it',
      runtimeArtifactRoot: 'base/vllm-fast',
      qualificationCorpusPath: 'seed/models/base/vllm-fast-qualification-corpus.json',
      qualificationReportPath: 'base/vllm-fast/qualification/latest.json',
      mustPassGates: ['canonical_container_boot'],
      scorecard: [{ name: 'quality', weight: 100 }],
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
        prompt: 'READY',
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
    }),
    'utf8',
  );
  await writeFile(path.join(root, 'seed/data/datasets/.gitkeep'), '', 'utf8');

  const config = loadCoreRuntimeConfig({
    YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
    YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
    YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
    YAAGI_MODELS_PATH: path.join(root, 'models'),
    YAAGI_DATA_PATH: path.join(root, 'data'),
  });

  return { root, config };
};

void test('AC-F0022-23 and AC-F0022-24 keep only valid skills in the runtime list while retaining diagnostics', async () => {
  const fixture = await createRuntimeFixture();
  const service = createRuntimeSkillsService(fixture.config);

  try {
    await materializeRuntimeSeed(fixture.config);
    await mkdir(path.join(fixture.config.workspaceSkillsPath, 'broken-skill'), { recursive: true });
    await writeFile(
      path.join(fixture.config.workspaceSkillsPath, 'broken-skill/README.md'),
      'broken',
      'utf8',
    );

    await service.start();

    const diagnostics = service.getDiagnostics();
    assert.deepEqual(diagnostics.validSkillIds, ['demo-skill']);
    assert.deepEqual(diagnostics.activeSkillIds, ['demo-skill']);
    assert.equal(
      diagnostics.skills.find((entry) => entry.skillId === 'broken-skill')?.reason,
      'missing_seed_package',
    );
    assert.equal(
      service
        .getLoadedSkills()
        .map((skill) => skill.skillId)
        .join(','),
      'demo-skill',
    );
  } finally {
    await service.stop();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

void test('AC-F0022-25 through AC-F0022-27 reload only from workspace and transition between active and inactive states', async () => {
  const fixture = await createRuntimeFixture();
  const service = createRuntimeSkillsService(fixture.config);
  const skillEntryPath = path.join(fixture.config.workspaceSkillsPath, 'demo-skill/SKILL.md');

  try {
    await materializeRuntimeSeed(fixture.config);
    await service.start();

    assert.deepEqual(service.getDiagnostics().activeSkillIds, ['demo-skill']);

    await unlink(skillEntryPath);
    await waitFor(() =>
      service
        .getDiagnostics()
        .skills.some(
          (entry) =>
            entry.skillId === 'demo-skill' &&
            entry.reason === 'workspace_validation_failed' &&
            entry.active === false,
        ),
    );

    await service.syncFromSeed();
    await waitFor(() => service.getDiagnostics().activeSkillIds.includes('demo-skill'));

    assert.deepEqual(service.getDiagnostics().activeSkillIds, ['demo-skill']);
  } finally {
    await service.stop();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

void test('AC-F0022-19 and AC-F0022-27 keep a changed seed skill active after explicit syncFromSeed completes', async () => {
  const fixture = await createRuntimeFixture();
  const service = createRuntimeSkillsService(fixture.config);

  try {
    await materializeRuntimeSeed(fixture.config);
    await service.start();

    await writeFile(
      path.join(fixture.config.seedSkillsPath, 'demo-skill/SKILL.md'),
      '# Demo Skill\n\nUpdated via sync.\n',
      'utf8',
    );

    await service.syncFromSeed();

    assert.deepEqual(service.getDiagnostics().activeSkillIds, ['demo-skill']);
    assert.equal(
      service.getDiagnostics().skills.find((entry) => entry.skillId === 'demo-skill')?.reason,
      null,
    );
  } finally {
    await service.stop();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

void test('AC-F0022-19 AC-F0022-25 and NFR-F0022-02 keep watcher reload scoped to workspace while explicit refresh can detect seed/workspace drift', async () => {
  const fixture = await createRuntimeFixture();
  const service = createRuntimeSkillsService(fixture.config);

  try {
    await materializeRuntimeSeed(fixture.config);
    await service.start();

    await writeFile(
      path.join(fixture.config.seedSkillsPath, 'demo-skill/SKILL.md'),
      '# Demo Skill\n\nUpdated in seed only.\n',
      'utf8',
    );

    await mkdir(path.join(fixture.config.workspaceSkillsPath, 'broken-skill'), { recursive: true });
    await writeFile(
      path.join(fixture.config.workspaceSkillsPath, 'broken-skill/README.md'),
      'broken',
      'utf8',
    );
    await waitFor(() =>
      service
        .getDiagnostics()
        .skills.some(
          (entry) => entry.skillId === 'broken-skill' && entry.reason === 'missing_seed_package',
        ),
    );
    assert.deepEqual(service.getDiagnostics().activeSkillIds, ['demo-skill']);

    await service.refresh();
    assert.equal(
      service.getDiagnostics().skills.find((entry) => entry.skillId === 'demo-skill')?.reason,
      'stale_workspace_copy',
    );
    assert.deepEqual(service.getDiagnostics().activeSkillIds, []);
  } finally {
    await service.stop();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

void test('AC-F0022-14 and AC-F0022-24 fail closed when sync from seed fails after the runtime is already active', async () => {
  const fixture = await createRuntimeFixture();
  const service = createRuntimeSkillsService(fixture.config);

  try {
    await materializeRuntimeSeed(fixture.config);
    await service.start();

    await rm(fixture.config.seedSkillsPath, { recursive: true, force: true });
    await assert.rejects(service.syncFromSeed(), /ENOENT|missing|directory/i);

    assert.deepEqual(service.getDiagnostics().activeSkillIds, []);
    assert.deepEqual(service.getDiagnostics().validSkillIds, []);
    assert.match(
      service.getDiagnostics().skills.find((entry) => entry.skillId === 'demo-skill')?.reason ?? '',
      /refresh_failed:/,
    );
  } finally {
    await service.stop();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

void test('AC-F0022-24 fails closed when the workspace skills root contains a symlink entry', async () => {
  const fixture = await createRuntimeFixture();
  const service = createRuntimeSkillsService(fixture.config);

  try {
    await materializeRuntimeSeed(fixture.config);
    await symlink(
      fixture.config.seedSkillsPath,
      path.join(fixture.config.workspaceSkillsPath, 'seed-link'),
    );

    await service.start();

    assert.deepEqual(service.getDiagnostics().activeSkillIds, []);
    assert.deepEqual(service.getDiagnostics().validSkillIds, []);
    assert.match(
      service.getDiagnostics().rootErrors.workspace.join('\n'),
      /unsupported non-directory entry/i,
    );
    assert.match(
      service.getDiagnostics().skills.find((entry) => entry.skillId === 'demo-skill')?.reason ?? '',
      /skills_root_invalid/,
    );
  } finally {
    await service.stop();
    await rm(fixture.root, { recursive: true, force: true });
  }
});
