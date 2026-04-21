import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

type PackageJson = {
  name?: string;
  dependencies?: Record<string, string>;
};

const readJson = async <T>(relativePath: string): Promise<T> =>
  JSON.parse(await readFile(path.join(repoRoot, relativePath), 'utf8')) as T;

void test('AC-F0022-01 AC-F0022-02 AC-F0022-03 AC-F0022-04 keeps the skills seam repo-owned and adjacent owner boundaries explicit', async () => {
  const skillsPackageJson = await readJson<PackageJson>('packages/skills/package.json');
  const corePackageJson = await readJson<PackageJson>('apps/core/package.json');
  const dossier = await readFile(
    path.join(repoRoot, 'docs/ssot/features/F-0022-skills-and-procedural-layer.md'),
    'utf8',
  );
  const runtimeSkillsSource = await readFile(
    path.join(repoRoot, 'apps/core/src/runtime/skills-runtime.ts'),
    'utf8',
  );

  assert.equal(skillsPackageJson.name, '@yaagi/skills');
  assert.equal(corePackageJson.dependencies?.['@yaagi/skills'], 'workspace:*');
  assert.match(runtimeSkillsSource, /from '@yaagi\/skills'/);
  assert.doesNotMatch(runtimeSkillsSource, /createRuntimeDbClient|createApp|new Hono/);
  assert.match(dossier, /AC-F0022-01:[\s\S]*единственным canonical owner seam/i);
  assert.match(dossier, /AC-F0022-02:[\s\S]*`F-0002` остаётся owner/i);
  assert.match(dossier, /AC-F0022-03:[\s\S]*`F-0010` остаётся owner/i);
  assert.match(dossier, /AC-F0022-04:[\s\S]*`F-0020` и AI SDK substrate остаются owner/i);
});

void test('AC-F0022-16 AC-F0022-17 keeps lifecycle states and a separate registry out of scope for v1', async () => {
  const dossier = await readFile(
    path.join(repoRoot, 'docs/ssot/features/F-0022-skills-and-procedural-layer.md'),
    'utf8',
  );
  const runtimeSkillsSource = await readFile(
    path.join(repoRoot, 'apps/core/src/runtime/skills-runtime.ts'),
    'utf8',
  );

  assert.match(dossier, /AC-F0022-16:[\s\S]*не вводит lifecycle-state модель/i);
  assert.match(dossier, /AC-F0022-17:[\s\S]*не требует отдельного DB\/runtime registry/i);
  assert.match(dossier, /Out of scope[\s\S]*lifecycle-state модель/i);
  assert.match(dossier, /Out of scope[\s\S]*DB\/runtime registry/i);
  assert.doesNotMatch(runtimeSkillsSource, /\bdraft\b|\bdeprecated\b|\bregistry\b/);
});
