import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'test.yml');

type RootPackageJson = {
  scripts: Record<string, string>;
};

const getScript = (rootPackageJson: RootPackageJson, scriptName: string): string => {
  const script = rootPackageJson.scripts[scriptName];
  if (script === undefined) {
    throw new Error(`${scriptName} must be defined`);
  }
  return script;
};

void test('AC-F0002-07 exposes a GitHub Actions testing workflow that reuses the canonical root command contract', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const rootPackageJson = JSON.parse(
    await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as RootPackageJson;

  assert.match(workflow, /^name: test$/m);
  assert.match(workflow, /^on:\n {2}pull_request:\n {2}push:\n {4}branches:\n {6}- master$/m);
  assert.match(workflow, /uses: actions\/checkout@v4/);
  assert.match(workflow, /uses: pnpm\/action-setup@v4/);
  assert.match(workflow, /uses: actions\/setup-node@v4/);
  assert.match(workflow, /node-version: '22'/);
  assert.match(workflow, /cache: pnpm/);
  assert.match(workflow, /run: pnpm install --frozen-lockfile/);
  assert.match(workflow, /run: pnpm quality:check/);
  assert.match(workflow, /run: pnpm test/);

  assert.equal(
    getScript(rootPackageJson, 'quality:check'),
    'pnpm format:check && pnpm typecheck && pnpm lint',
  );
  assert.equal(
    workflow.includes('run: pnpm format:check') ||
      workflow.includes('run: pnpm typecheck') ||
      workflow.includes('run: pnpm lint'),
    false,
  );
});

void test('AC-F0002-08 preserves the canonical GitHub Actions order quality:check then test', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const rootPackageJson = JSON.parse(
    await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as RootPackageJson;

  const qualityCheckIndex = workflow.indexOf('run: pnpm quality:check');
  const testIndex = workflow.indexOf('run: pnpm test');

  assert.notEqual(qualityCheckIndex, -1);
  assert.notEqual(testIndex, -1);
  assert.ok(qualityCheckIndex < testIndex);

  assert.deepEqual(getScript(rootPackageJson, 'quality:check').split(' && '), [
    'pnpm format:check',
    'pnpm typecheck',
    'pnpm lint',
  ]);
});
