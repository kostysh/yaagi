import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  loadSkillPackage,
  syncSkillTreeFromSeed,
  validateSkillPackage,
  validateSkillTree,
} from '../src/index.ts';

// Covers: AC-F0022-05, AC-F0022-06, AC-F0022-13, AC-F0022-18, AC-F0022-19, AC-F0022-21, AC-F0022-22

const createSkillFixture = async (): Promise<{
  root: string;
  seedSkillsPath: string;
  workspaceSkillsPath: string;
}> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-skills-'));
  const seedSkillsPath = path.join(root, 'seed/skills');
  const workspaceSkillsPath = path.join(root, 'workspace/skills');

  await mkdir(path.join(seedSkillsPath, 'demo-skill/references'), { recursive: true });
  await mkdir(workspaceSkillsPath, { recursive: true });

  await writeFile(
    path.join(seedSkillsPath, 'demo-skill/SKILL.md'),
    '# Demo Skill\n\nUse this package to verify runtime skill loading.\n',
    'utf8',
  );
  await writeFile(
    path.join(seedSkillsPath, 'demo-skill/references/checklist.md'),
    '- verify validator\n- verify loader\n',
    'utf8',
  );

  return { root, seedSkillsPath, workspaceSkillsPath };
};

void test('AC-F0022-21 validates a canonical skill package and exposes its support files', async () => {
  const fixture = await createSkillFixture();

  try {
    const result = await validateSkillPackage(path.join(fixture.seedSkillsPath, 'demo-skill'));
    assert.equal(result.valid, true);
    assert.ok(result.entryMdPath?.endsWith('SKILL.md'));
    assert.equal(result.errors.length, 0);
    assert.ok(result.fingerprint);
    assert.deepEqual(
      result.supportPaths.references.map((targetPath) => path.basename(targetPath)),
      ['checklist.md'],
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

void test('AC-F0022-21 rejects a package that misses SKILL.md or has unsupported root entries', async () => {
  const fixture = await createSkillFixture();

  try {
    const invalidSkillPath = path.join(fixture.seedSkillsPath, 'broken-skill');
    await mkdir(path.join(invalidSkillPath, 'notes'), { recursive: true });
    await writeFile(path.join(invalidSkillPath, 'notes/info.md'), 'not allowed', 'utf8');

    const result = await validateSkillPackage(invalidSkillPath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /missing required SKILL\.md/);
    assert.match(result.errors.join('\n'), /unsupported root entry/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

void test('AC-F0022-22 separates valid and invalid skills when validating the full tree', async () => {
  const fixture = await createSkillFixture();

  try {
    const invalidSkillPath = path.join(fixture.seedSkillsPath, 'broken-skill');
    await mkdir(invalidSkillPath, { recursive: true });
    await writeFile(path.join(invalidSkillPath, 'README.md'), 'broken', 'utf8');

    const result = await validateSkillTree(fixture.seedSkillsPath);
    assert.equal(result.validSkills.length, 1);
    assert.equal(result.invalidSkills.length, 1);
    assert.equal(result.validSkills[0]?.skillId, 'demo-skill');
    assert.equal(result.invalidSkills[0]?.skillId, 'broken-skill');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

void test('AC-F0022-11 loads a valid materialized skill package for runtime use', async () => {
  const fixture = await createSkillFixture();

  try {
    await syncSkillTreeFromSeed({
      seedRootPath: fixture.seedSkillsPath,
      workspaceRootPath: fixture.workspaceSkillsPath,
    });

    const loaded = await loadSkillPackage(path.join(fixture.workspaceSkillsPath, 'demo-skill'));
    assert.equal(loaded.skillId, 'demo-skill');
    assert.match(loaded.entryMarkdown, /Demo Skill/);
    assert.deepEqual(
      loaded.referencesPaths.map((targetPath) => path.basename(targetPath)),
      ['checklist.md'],
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

void test('AC-F0022-19 syncs the skills tree from seed into workspace and removes stale copies', async () => {
  const fixture = await createSkillFixture();

  try {
    const invalidSkillPath = path.join(fixture.seedSkillsPath, 'broken-skill');
    await mkdir(invalidSkillPath, { recursive: true });
    await writeFile(path.join(invalidSkillPath, 'README.md'), 'broken', 'utf8');
    await mkdir(path.join(fixture.workspaceSkillsPath, 'stale-skill'), { recursive: true });
    await writeFile(
      path.join(fixture.workspaceSkillsPath, 'stale-skill/SKILL.md'),
      '# stale\n',
      'utf8',
    );

    const syncResult = await syncSkillTreeFromSeed({
      seedRootPath: fixture.seedSkillsPath,
      workspaceRootPath: fixture.workspaceSkillsPath,
    });

    assert.deepEqual(syncResult.copiedSkillIds, ['demo-skill']);
    assert.deepEqual(syncResult.removedSkillIds, ['stale-skill']);
    await assert.rejects(readFile(path.join(fixture.workspaceSkillsPath, 'stale-skill/SKILL.md')));
    await assert.rejects(
      readFile(path.join(fixture.workspaceSkillsPath, 'broken-skill/README.md')),
    );
    assert.match(
      await readFile(path.join(fixture.workspaceSkillsPath, 'demo-skill/SKILL.md'), 'utf8'),
      /Demo Skill/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
