import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { CoreRuntimeConfig } from '../../src/platform/core-config.ts';
import { createBodyEvolutionGitGateway } from '../../src/body/git-gateway.ts';

const execFileAsync = promisify(execFile);

const createConfig = (rootPath: string): CoreRuntimeConfig => ({
  postgresUrl: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
  fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
  fastModelDescriptorPath: path.join(rootPath, 'seed', 'models', 'base', 'vllm-fast-manifest.json'),
  deepModelBaseUrl: 'http://127.0.0.1:8001/v1',
  poolModelBaseUrl: 'http://127.0.0.1:8002/v1',
  telegramEnabled: false,
  telegramBotToken: null,
  telegramAllowedChatIds: [],
  telegramEgressEnabled: false,
  telegramOperatorChatId: null,
  telegramApiBaseUrl: 'https://api.telegram.org',
  seedRootPath: path.join(rootPath, 'seed'),
  seedConstitutionPath: path.join(rootPath, 'seed', 'constitution', 'constitution.yaml'),
  seedBodyPath: path.join(rootPath, 'seed', 'body'),
  seedSkillsPath: path.join(rootPath, 'seed', 'skills'),
  seedModelsPath: path.join(rootPath, 'seed', 'models'),
  seedDataPath: path.join(rootPath, 'seed', 'data'),
  workspaceBodyPath: path.join(rootPath, 'workspace', 'body'),
  workspaceSkillsPath: path.join(rootPath, 'workspace', 'skills'),
  modelsPath: path.join(rootPath, 'models'),
  dataPath: path.join(rootPath, 'data'),
  migrationsDir: path.join(rootPath, 'infra', 'migrations'),
  pgBossSchema: 'pgboss',
  operatorAuthPrincipalsFilePath: null,
  operatorAuthRateLimitWindowMs: 60_000,
  operatorAuthRateLimitMaxRequests: 120,
  host: '127.0.0.1',
  port: 8787,
  bootTimeoutMs: 60_000,
});

const git = async (cwd: string, args: string[]): Promise<string> => {
  const result = await execFileAsync('git', args, { cwd });
  return result.stdout.trim();
};

const createGitRepo = async (): Promise<{ rootPath: string; config: CoreRuntimeConfig }> => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'yaagi-body-git-gateway-'));
  const config = createConfig(rootPath);
  await mkdir(config.seedBodyPath, { recursive: true });
  await mkdir(path.join(config.workspaceBodyPath, 'src'), { recursive: true });
  await writeFile(
    path.join(config.workspaceBodyPath, 'src', 'body.ts'),
    'export const body = 1;\n',
  );
  await git(config.workspaceBodyPath, ['init']);
  await git(config.workspaceBodyPath, ['config', 'user.email', 'test@example.com']);
  await git(config.workspaceBodyPath, ['config', 'user.name', 'YAAGI Test']);
  await git(config.workspaceBodyPath, ['add', '-A']);
  await git(config.workspaceBodyPath, ['commit', '-m', 'init']);
  return {
    rootPath,
    config,
  };
};

void test('git gateway creates nested worktrees, commits candidates and tags stable snapshots inside the writable body', async () => {
  const { config } = await createGitRepo();
  const gateway = createBodyEvolutionGitGateway({ config });
  const worktreePath = path.join(
    config.workspaceBodyPath,
    '.yaagi',
    'body-proposals',
    'candidate-1',
  );

  await gateway.createWorktree({
    branchName: 'agent/proposals/candidate-1',
    worktreePath,
  });
  await gateway.createWorktree({
    branchName: 'agent/proposals/candidate-1',
    worktreePath,
  });

  const initialContent = await readFile(path.join(worktreePath, 'src', 'body.ts'), 'utf8');
  assert.equal(initialContent, 'export const body = 1;\n');

  await writeFile(path.join(worktreePath, 'src', 'body.ts'), 'export const body = 2;\n');
  const commit = await gateway.commitCandidate({
    worktreePath,
    message: 'feat(body): candidate',
  });
  const headCommit = await git(worktreePath, ['rev-parse', 'HEAD']);
  const replayedCommit = await gateway.findCommittedCandidate({
    worktreePath,
    message: 'feat(body): candidate',
  });
  const tag = await gateway.createStableTag({
    worktreePath,
    snapshotId: 'stable-snapshot:candidate-1',
    commitSha: commit.commitSha,
  });
  const replayedTag = await gateway.createStableTag({
    worktreePath,
    snapshotId: 'stable-snapshot:candidate-1',
    commitSha: commit.commitSha,
  });
  const taggedCommit = await git(worktreePath, ['rev-parse', `refs/tags/${tag.gitTag}`]);

  assert.equal(commit.commitSha, headCommit);
  assert.deepEqual(replayedCommit, {
    commitSha: commit.commitSha,
  });
  assert.equal(tag.gitTag, 'stable/stable-snapshot-candidate-1');
  assert.deepEqual(replayedTag, tag);
  assert.equal(taggedCommit, commit.commitSha);
});

void test('git gateway rejects worktree paths that escape the materialized writable body', async () => {
  const { rootPath, config } = await createGitRepo();
  const gateway = createBodyEvolutionGitGateway({ config });

  await assert.rejects(
    gateway.createWorktree({
      branchName: 'agent/proposals/escape',
      worktreePath: path.join(rootPath, 'outside-worktree'),
    }),
    /escapes the materialized writable body/,
  );
});
