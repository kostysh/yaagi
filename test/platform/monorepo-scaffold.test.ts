import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const execFileAsync = promisify(execFile);

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const isIgnoredByGit = async (relativePath: string): Promise<boolean> => {
  try {
    await execFileAsync('git', ['check-ignore', relativePath], { cwd: repoRoot });
    return true;
  } catch {
    return false;
  }
};

void test('AC-F0002-01 exposes the canonical pnpm monorepo scaffold and workspace layout', async () => {
  const rootPackageJson = JSON.parse(
    await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as {
    packageManager: string;
    scripts: Record<string, string>;
  };
  const workspaceYaml = await readFile(path.join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');
  const gitignore = await readFile(path.join(repoRoot, '.gitignore'), 'utf8');

  assert.match(rootPackageJson.packageManager, /^pnpm@/);
  assert.equal(typeof rootPackageJson.scripts['typecheck'], 'string');
  assert.equal(typeof rootPackageJson.scripts['test'], 'string');
  assert.equal(typeof rootPackageJson.scripts['cell:up'], 'string');
  assert.equal(typeof rootPackageJson.scripts['cell:down'], 'string');
  assert.equal(typeof rootPackageJson.scripts['smoke:cell'], 'string');

  assert.match(workspaceYaml, /apps\/\*/);
  assert.match(workspaceYaml, /packages\/\*/);
  assert.match(gitignore, /^\/workspace\/$/m);
  assert.match(gitignore, /^\/models\/$/m);
  assert.match(gitignore, /^\/data\/$/m);
  assert.equal(await isIgnoredByGit('workspace/body/runtime-check.txt'), true);
  assert.equal(await isIgnoredByGit('models/base/runtime-check.txt'), true);
  assert.equal(await isIgnoredByGit('data/datasets/runtime-check.txt'), true);
  assert.equal(await isIgnoredByGit('seed/constitution/constitution.yaml'), false);

  const requiredPaths = [
    'apps/core/package.json',
    'apps/workshop/package.json',
    'packages/contracts/package.json',
    'packages/domain/package.json',
    'packages/db/package.json',
    'packages/evals/package.json',
    'packages/skills/package.json',
    'packages/testkits/package.json',
    'seed/body/.gitkeep',
    'seed/skills/.gitkeep',
    'seed/constitution/constitution.yaml',
    'seed/models/base/.gitkeep',
    'seed/models/adapters/.gitkeep',
    'seed/models/specialists/.gitkeep',
    'seed/data/datasets/.gitkeep',
    'seed/data/reports/.gitkeep',
    'seed/data/snapshots/.gitkeep',
    'infra/docker/compose.yaml',
    'infra/migrations/001_platform_bootstrap.sql',
  ];

  for (const relativePath of requiredPaths) {
    assert.equal(
      await fileExists(path.join(repoRoot, relativePath)),
      true,
      `${relativePath} must exist in the canonical scaffold`,
    );
  }
});
