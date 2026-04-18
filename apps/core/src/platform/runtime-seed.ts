import path from 'node:path';
import { access, cp, lstat, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { syncSkillTreeFromSeed } from '@yaagi/skills';
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

const assertNoSymlinkSegments = async (targetPath: string): Promise<void> => {
  const resolvedTargetPath = path.resolve(targetPath);
  const { root } = path.parse(resolvedTargetPath);
  const segments = resolvedTargetPath.slice(root.length).split(path.sep).filter(Boolean);
  let currentPath = root;

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    const entryStat = await lstat(currentPath).catch(() => null);

    if (!entryStat) {
      break;
    }

    if (entryStat.isSymbolicLink()) {
      throw new Error(`runtime path must not traverse a symlinked segment: ${currentPath}`);
    }
  }
};

const isPlaceholderTree = async (targetPath: string): Promise<boolean> => {
  let entries: string[];
  try {
    entries = await listEntries(targetPath);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'EACCES' || error.code === 'EPERM')
    ) {
      return false;
    }
    throw error;
  }

  for (const entryName of entries) {
    if (entryName === '.gitkeep') {
      continue;
    }

    // Hidden runtime cache/config trees indicate a live materialized runtime and
    // must not be traversed during bootstrap placeholder detection.
    if (entryName.startsWith('.')) {
      return false;
    }

    const entryPath = path.join(targetPath, entryName);
    let entryStat: Awaited<ReturnType<typeof lstat>>;
    try {
      entryStat = await lstat(entryPath);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error.code === 'EACCES' || error.code === 'EPERM')
      ) {
        return false;
      }
      throw error;
    }
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
  await assertNoSymlinkSegments(sourcePath);
  await assertNoSymlinkSegments(targetPath);
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

const materializeSkillDirectory = async (
  sourcePath: string,
  targetPath: string,
): Promise<MaterializationState> => {
  await assertNoSymlinkSegments(sourcePath);
  await assertNoSymlinkSegments(targetPath);
  await assertExists(sourcePath);
  await ensureDirectory(targetPath);

  if (!(await isPlaceholderTree(targetPath))) {
    return 'reused';
  }

  await syncSkillTreeFromSeed({
    seedRootPath: sourcePath,
    workspaceRootPath: targetPath,
  });

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
    skills: await materializeSkillDirectory(config.seedSkillsPath, config.workspaceSkillsPath),
    models: await materializeDirectory(config.seedModelsPath, config.modelsPath),
    data: await materializeDirectory(config.seedDataPath, config.dataPath),
  };
}

export async function syncRuntimeSkillsFromSeed(config: CoreRuntimeConfig): Promise<void> {
  assertSeparatedBoundary(config);
  await assertNoSymlinkSegments(config.seedSkillsPath);
  await assertNoSymlinkSegments(config.workspaceSkillsPath);
  await syncSkillTreeFromSeed({
    seedRootPath: config.seedSkillsPath,
    workspaceRootPath: config.workspaceSkillsPath,
  });
}
