import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

test('AC-F0002-01 exposes the canonical pnpm monorepo scaffold and workspace layout', async () => {
  const rootPackageJson = JSON.parse(
    await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as {
    packageManager: string;
    scripts: Record<string, string>;
  };
  const workspaceYaml = await readFile(path.join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');

  assert.match(rootPackageJson.packageManager, /^pnpm@/);
  assert.equal(typeof rootPackageJson.scripts['typecheck'], 'string');
  assert.equal(typeof rootPackageJson.scripts['test'], 'string');
  assert.equal(typeof rootPackageJson.scripts['cell:up'], 'string');
  assert.equal(typeof rootPackageJson.scripts['cell:down'], 'string');
  assert.equal(typeof rootPackageJson.scripts['smoke:cell'], 'string');

  assert.match(workspaceYaml, /apps\/\*/);
  assert.match(workspaceYaml, /packages\/\*/);

  const requiredPaths = [
    'apps/core/package.json',
    'apps/workshop/package.json',
    'packages/contracts/package.json',
    'packages/domain/package.json',
    'packages/db/package.json',
    'packages/evals/package.json',
    'packages/skills/package.json',
    'packages/testkits/package.json',
    'workspace/body/.gitkeep',
    'workspace/skills/.gitkeep',
    'workspace/constitution/constitution.yaml',
    'models/base/.gitkeep',
    'models/adapters/.gitkeep',
    'models/specialists/.gitkeep',
    'data/datasets/.gitkeep',
    'data/reports/.gitkeep',
    'data/snapshots/.gitkeep',
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
