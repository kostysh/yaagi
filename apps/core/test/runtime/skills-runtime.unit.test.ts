import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { RuntimeSkillsService } from '../../src/runtime/skills-runtime.ts';

// Covers: AC-F0022-11, AC-F0022-15, AC-F0022-23, AC-F0022-24, AC-F0022-25, AC-F0022-27

type RuntimeSkillsModule = {
  createRuntimeSkillsService(config: {
    seedSkillsPath: string;
    workspaceSkillsPath: string;
  }): RuntimeSkillsService;
};

const loadRuntimeSkillsModule = async (suffix: string): Promise<RuntimeSkillsModule> =>
  (await import(`../../src/runtime/skills-runtime.ts?${suffix}`)) as RuntimeSkillsModule;

void test('AC-F0022-23 and AC-F0022-24 keep a valid materialized skill listed even when adapter load fails', async () => {
  const supportPaths = {
    references: [],
    scripts: [],
    assets: [],
  };
  const seedSkill = {
    skillId: 'demo-skill',
    path: '/seed/skills/demo-skill',
    valid: true,
    errors: [],
    warnings: [],
    entryMdPath: '/seed/skills/demo-skill/SKILL.md',
    fingerprint: 'demo-fingerprint',
    supportPaths,
  };
  const workspaceSkill = {
    ...seedSkill,
    path: '/workspace/skills/demo-skill',
    entryMdPath: '/workspace/skills/demo-skill/SKILL.md',
  };
  const validateSkillTree = (rootPath: string) =>
    Promise.resolve({
      rootPath,
      allSkills: [rootPath.startsWith('/seed') ? seedSkill : workspaceSkill],
      validSkills: [rootPath.startsWith('/seed') ? seedSkill : workspaceSkill],
      invalidSkills: [],
      rootErrors: [],
      rootWarnings: [],
    });
  const loadSkillPackage = () => Promise.reject(new Error('adapter boom'));
  const syncSkillTreeFromSeed = () => Promise.resolve(undefined);
  const skillsMock = mock.module('@yaagi/skills', {
    namedExports: {
      validateSkillTree,
      loadSkillPackage,
      syncSkillTreeFromSeed,
    },
  });

  try {
    const runtimeSkillsModule = await loadRuntimeSkillsModule(`adapter-failure-${Date.now()}`);
    const service = runtimeSkillsModule.createRuntimeSkillsService({
      seedSkillsPath: '/seed/skills',
      workspaceSkillsPath: '/workspace/skills',
    });

    await service.refresh();

    assert.deepEqual(service.getDiagnostics().validSkillIds, ['demo-skill']);
    assert.deepEqual(service.getDiagnostics().activeSkillIds, []);
    assert.equal(service.getDiagnostics().skills[0]?.listed, true);
    assert.equal(service.getDiagnostics().skills[0]?.active, false);
    assert.match(
      service.getDiagnostics().skills[0]?.reason ?? '',
      /adapter_load_failed:adapter boom/,
    );
  } finally {
    skillsMock.restore();
  }
});

void test('AC-F0022-25 keeps a stale refresh from publishing after a newer refresh is already queued', async () => {
  let workspaceCallCount = 0;
  let releaseFirstWorkspace: (() => void) | undefined;
  let releaseSecondWorkspace: (() => void) | undefined;
  const supportPaths = {
    references: [],
    scripts: [],
    assets: [],
  };
  const seedTreeByRun = {
    1: {
      rootPath: '/seed/skills',
      allSkills: [
        {
          skillId: 'demo-skill',
          path: '/seed/skills/demo-skill',
          valid: true,
          errors: [],
          warnings: [],
          entryMdPath: '/seed/skills/demo-skill/SKILL.md',
          fingerprint: 'v1',
          supportPaths,
        },
      ],
      validSkills: [
        {
          skillId: 'demo-skill',
          path: '/seed/skills/demo-skill',
          valid: true,
          errors: [],
          warnings: [],
          entryMdPath: '/seed/skills/demo-skill/SKILL.md',
          fingerprint: 'v1',
          supportPaths,
        },
      ],
      invalidSkills: [],
      rootErrors: [],
      rootWarnings: [],
    },
    2: {
      rootPath: '/seed/skills',
      allSkills: [
        {
          skillId: 'demo-skill',
          path: '/seed/skills/demo-skill',
          valid: true,
          errors: [],
          warnings: [],
          entryMdPath: '/seed/skills/demo-skill/SKILL.md',
          fingerprint: 'v2',
          supportPaths,
        },
      ],
      validSkills: [
        {
          skillId: 'demo-skill',
          path: '/seed/skills/demo-skill',
          valid: true,
          errors: [],
          warnings: [],
          entryMdPath: '/seed/skills/demo-skill/SKILL.md',
          fingerprint: 'v2',
          supportPaths,
        },
      ],
      invalidSkills: [],
      rootErrors: [],
      rootWarnings: [],
    },
  };
  const workspaceTreeByRun = {
    1: {
      rootPath: '/workspace/skills',
      allSkills: [
        {
          skillId: 'demo-skill',
          path: '/workspace/skills/demo-skill',
          valid: true,
          errors: [],
          warnings: [],
          entryMdPath: '/workspace/skills/demo-skill/SKILL.md',
          fingerprint: 'v1',
          supportPaths,
        },
      ],
      validSkills: [
        {
          skillId: 'demo-skill',
          path: '/workspace/skills/demo-skill',
          valid: true,
          errors: [],
          warnings: [],
          entryMdPath: '/workspace/skills/demo-skill/SKILL.md',
          fingerprint: 'v1',
          supportPaths,
        },
      ],
      invalidSkills: [],
      rootErrors: [],
      rootWarnings: [],
    },
    2: {
      rootPath: '/workspace/skills',
      allSkills: [],
      validSkills: [],
      invalidSkills: [],
      rootErrors: [],
      rootWarnings: [],
    },
  };
  const validateSkillTree = (rootPath: string) => {
    if (rootPath.startsWith('/workspace')) {
      workspaceCallCount += 1;
      if (workspaceCallCount === 1) {
        return new Promise<(typeof workspaceTreeByRun)[1]>((resolve) => {
          releaseFirstWorkspace = () => resolve(workspaceTreeByRun[1]);
        });
      }
      if (workspaceCallCount === 2) {
        return new Promise<(typeof workspaceTreeByRun)[2]>((resolve) => {
          releaseSecondWorkspace = () => resolve(workspaceTreeByRun[2]);
        });
      }
      return Promise.resolve(workspaceTreeByRun[workspaceCallCount as 1 | 2]);
    }

    return Promise.resolve(seedTreeByRun[Math.min(workspaceCallCount, 2) as 1 | 2]);
  };
  const loadSkillPackage = () =>
    Promise.resolve({
      skillId: 'demo-skill',
      workspacePath: '/workspace/skills/demo-skill',
      entryMdPath: '/workspace/skills/demo-skill/SKILL.md',
      entryMarkdown: '# Demo Skill',
      fingerprint: 'v1',
      referencesPaths: [],
      scriptsPaths: [],
      assetsPaths: [],
    });
  const syncSkillTreeFromSeed = () => Promise.resolve(undefined);
  const skillsMock = mock.module('@yaagi/skills', {
    namedExports: {
      validateSkillTree,
      loadSkillPackage,
      syncSkillTreeFromSeed,
    },
  });

  try {
    const runtimeSkillsModule = await loadRuntimeSkillsModule(`stale-refresh-${Date.now()}`);
    const service = runtimeSkillsModule.createRuntimeSkillsService({
      seedSkillsPath: '/seed/skills',
      workspaceSkillsPath: '/workspace/skills',
    });
    const firstRefresh = service.refresh();

    while (workspaceCallCount < 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const secondRefresh = service.refresh();
    if (releaseFirstWorkspace) {
      releaseFirstWorkspace();
    }

    while (workspaceCallCount < 2) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    assert.deepEqual(service.getDiagnostics().validSkillIds, []);
    assert.deepEqual(service.getDiagnostics().activeSkillIds, []);

    if (releaseSecondWorkspace) {
      releaseSecondWorkspace();
    }
    await Promise.all([firstRefresh, secondRefresh]);

    assert.deepEqual(service.getDiagnostics().validSkillIds, []);
    assert.deepEqual(service.getDiagnostics().activeSkillIds, []);
  } finally {
    skillsMock.restore();
  }
});
