import path from 'node:path';
import { access, cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import type { CoreRuntimeConfig } from './core-config.ts';

type MaterializationState = 'seeded' | 'reused';

export type RuntimeSeedMaterializationResult = {
  body: MaterializationState;
  skills: MaterializationState;
  models: MaterializationState;
  data: MaterializationState;
};

const assertExists = async (targetPath: string): Promise<void> => {
  await access(targetPath);
};

const listEntries = async (targetPath: string): Promise<string[]> => {
  try {
    return await readdir(targetPath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const ensureDirectory = async (targetPath: string): Promise<void> => {
  await mkdir(targetPath, { recursive: true });
};

const isPlaceholderTree = async (targetPath: string): Promise<boolean> => {
  const entries = await listEntries(targetPath);

  for (const entryName of entries) {
    if (entryName === '.gitkeep') {
      continue;
    }

    const entryPath = path.join(targetPath, entryName);
    const entryStat = await stat(entryPath);
    if (!entryStat.isDirectory()) {
      return false;
    }

    if (!(await isPlaceholderTree(entryPath))) {
      return false;
    }
  }

  return true;
};

const isNestedPath = (rootPath: string, targetPath: string): boolean => {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const assertSeparatedBoundary = (config: CoreRuntimeConfig): void => {
  const pairs: Array<[string, string]> = [
    [config.seedRootPath, config.workspaceBodyPath],
    [config.seedRootPath, config.workspaceSkillsPath],
    [config.seedRootPath, config.modelsPath],
    [config.seedRootPath, config.dataPath],
  ];

  for (const [seedPath, runtimePath] of pairs) {
    if (
      seedPath === runtimePath ||
      isNestedPath(seedPath, runtimePath) ||
      isNestedPath(runtimePath, seedPath)
    ) {
      throw new Error(
        `runtime path ${runtimePath} must stay outside the tracked seed boundary ${seedPath}`,
      );
    }
  }
};

const materializeDirectory = async (
  sourcePath: string,
  targetPath: string,
): Promise<MaterializationState> => {
  await assertExists(sourcePath);
  await ensureDirectory(targetPath);

  if (!(await isPlaceholderTree(targetPath))) {
    return 'reused';
  }

  const targetEntries = await listEntries(targetPath);
  if (targetEntries.includes('.gitkeep')) {
    await rm(path.join(targetPath, '.gitkeep'), { force: true });
  }

  const sourceEntries = await listEntries(sourcePath);
  for (const entryName of sourceEntries) {
    const sourceEntryPath = path.join(sourcePath, entryName);
    const targetEntryPath = path.join(targetPath, entryName);
    const sourceEntryStat = await stat(sourceEntryPath);

    if (sourceEntryStat.isDirectory()) {
      await ensureDirectory(targetEntryPath);
      await materializeDirectory(sourceEntryPath, targetEntryPath);
      continue;
    }

    await cp(sourceEntryPath, targetEntryPath, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
  }

  return 'seeded';
};

export async function materializeRuntimeSeed(
  config: CoreRuntimeConfig,
): Promise<RuntimeSeedMaterializationResult> {
  assertSeparatedBoundary(config);

  await assertExists(config.seedRootPath);
  await assertExists(config.seedConstitutionPath);

  return {
    body: await materializeDirectory(config.seedBodyPath, config.workspaceBodyPath),
    skills: await materializeDirectory(config.seedSkillsPath, config.workspaceSkillsPath),
    models: await materializeDirectory(config.seedModelsPath, config.modelsPath),
    data: await materializeDirectory(config.seedDataPath, config.dataPath),
  };
}
