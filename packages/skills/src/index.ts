import { randomUUID, createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const SKILL_ENTRY_FILENAME = 'SKILL.md';
const ALLOWED_SUPPORT_DIRS = ['references', 'scripts', 'assets'] as const;

type SkillSupportDir = (typeof ALLOWED_SUPPORT_DIRS)[number];
type SupportPathGroups = Record<SkillSupportDir, string[]>;

type CandidateRootEntry = {
  name: string;
  absolutePath: string;
  kind: 'file' | 'directory' | 'other';
};

type SupportScanResult = {
  files: string[];
  errors: string[];
};

export type SkillValidationResult = {
  skillId: string;
  path: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  entryMdPath: string | null;
  fingerprint: string | null;
  supportPaths: SupportPathGroups;
};

export type SkillTreeValidationResult = {
  rootPath: string;
  allSkills: SkillValidationResult[];
  validSkills: SkillValidationResult[];
  invalidSkills: SkillValidationResult[];
  rootErrors: string[];
  rootWarnings: string[];
};

export type LoadedSkill = {
  skillId: string;
  workspacePath: string;
  entryMdPath: string;
  entryMarkdown: string;
  fingerprint: string;
  referencesPaths: string[];
  scriptsPaths: string[];
  assetsPaths: string[];
};

export type SkillTreeSyncResult = {
  copiedSkillIds: string[];
  removedSkillIds: string[];
};

const isIgnorableEntry = (entryName: string): boolean => entryName === '.gitkeep';

const listVisibleEntries = async (targetPath: string): Promise<string[]> =>
  (await readdir(targetPath)).filter((entryName) => !isIgnorableEntry(entryName));

const readCandidateRootEntries = async (skillPath: string): Promise<CandidateRootEntry[]> => {
  const entryNames = await listVisibleEntries(skillPath);
  const entries: CandidateRootEntry[] = [];

  for (const entryName of entryNames) {
    const absolutePath = path.join(skillPath, entryName);
    const entryStat = await lstat(absolutePath, { bigint: false });
    entries.push({
      name: entryName,
      absolutePath,
      kind: entryStat.isDirectory() ? 'directory' : entryStat.isFile() ? 'file' : 'other',
    });
  }

  return entries.sort((left, right) => left.name.localeCompare(right.name));
};

const makeSupportPaths = (): SupportPathGroups => ({
  references: [],
  scripts: [],
  assets: [],
});

const scanSupportTree = async (rootPath: string): Promise<SupportScanResult> => {
  const files: string[] = [];
  const errors: string[] = [];
  const stack = [rootPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    if (!currentPath) {
      continue;
    }

    const entryNames = await listVisibleEntries(currentPath);
    entryNames.sort((left, right) => left.localeCompare(right));

    for (const entryName of entryNames) {
      const absolutePath = path.join(currentPath, entryName);
      const entryStat = await lstat(absolutePath, { bigint: false });

      if (entryStat.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (!entryStat.isFile()) {
        errors.push(`unsupported entry inside support subtree: ${absolutePath}`);
        continue;
      }

      files.push(absolutePath);
    }
  }

  files.sort((left, right) => left.localeCompare(right));
  return { files, errors };
};

const buildFingerprint = async (skillPath: string, absolutePaths: string[]): Promise<string> => {
  const hash = createHash('sha256');

  for (const absolutePath of absolutePaths) {
    const relativePath = path.relative(skillPath, absolutePath);
    hash.update(relativePath);
    hash.update('\u0000');
    hash.update(await readFile(absolutePath));
    hash.update('\u0000');
  }

  return hash.digest('hex');
};

const collectTreeRootState = async (
  rootPath: string,
): Promise<{ skillDirs: string[]; rootErrors: string[]; rootWarnings: string[] }> => {
  const rootErrors: string[] = [];
  const rootWarnings: string[] = [];
  const skillDirs: string[] = [];
  const entryNames = await listVisibleEntries(rootPath);
  entryNames.sort((left, right) => left.localeCompare(right));

  for (const entryName of entryNames) {
    const absolutePath = path.join(rootPath, entryName);
    const entryStat = await lstat(absolutePath, { bigint: false });

    if (entryStat.isDirectory()) {
      skillDirs.push(entryName);
      continue;
    }

    rootErrors.push(`skills root contains unsupported non-directory entry: ${absolutePath}`);
  }

  return { skillDirs, rootErrors, rootWarnings };
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
      throw new Error(`path must not traverse a symlinked segment: ${currentPath}`);
    }
  }
};

export async function validateSkillPackage(skillPath: string): Promise<SkillValidationResult> {
  const resolvedSkillPath = path.resolve(skillPath);
  const skillId = path.basename(resolvedSkillPath);
  const errors: string[] = [];
  const warnings: string[] = [];
  const supportPaths = makeSupportPaths();

  const rootStat = await lstat(resolvedSkillPath, { bigint: false }).catch(() => null);
  if (!rootStat?.isDirectory()) {
    return {
      skillId,
      path: resolvedSkillPath,
      valid: false,
      errors: [`skill package is missing or not a directory: ${resolvedSkillPath}`],
      warnings,
      entryMdPath: null,
      fingerprint: null,
      supportPaths,
    };
  }

  const rootEntries = await readCandidateRootEntries(resolvedSkillPath);
  const entryMdPath = path.join(resolvedSkillPath, SKILL_ENTRY_FILENAME);
  let hasEntryMd = false;
  const fingerprintInputs: string[] = [];

  for (const entry of rootEntries) {
    if (entry.name === SKILL_ENTRY_FILENAME) {
      if (entry.kind !== 'file') {
        errors.push(`${SKILL_ENTRY_FILENAME} must be a file: ${entry.absolutePath}`);
      } else {
        hasEntryMd = true;
        fingerprintInputs.push(entry.absolutePath);
      }
      continue;
    }

    if (
      entry.kind === 'directory' &&
      (ALLOWED_SUPPORT_DIRS as readonly string[]).includes(entry.name)
    ) {
      const supportKey = entry.name as SkillSupportDir;
      const supportScan = await scanSupportTree(entry.absolutePath);
      supportPaths[supportKey] = supportScan.files;
      fingerprintInputs.push(...supportScan.files);
      errors.push(...supportScan.errors);
      continue;
    }

    errors.push(`unsupported root entry in skill package: ${entry.absolutePath}`);
  }

  if (!hasEntryMd) {
    errors.push(`skill package is missing required ${SKILL_ENTRY_FILENAME}: ${entryMdPath}`);
  }

  if (errors.length > 0) {
    return {
      skillId,
      path: resolvedSkillPath,
      valid: false,
      errors,
      warnings,
      entryMdPath: hasEntryMd ? entryMdPath : null,
      fingerprint: null,
      supportPaths,
    };
  }

  fingerprintInputs.sort((left, right) => left.localeCompare(right));
  return {
    skillId,
    path: resolvedSkillPath,
    valid: true,
    errors,
    warnings,
    entryMdPath,
    fingerprint: await buildFingerprint(resolvedSkillPath, fingerprintInputs),
    supportPaths,
  };
}

export async function validateSkillTree(rootPath: string): Promise<SkillTreeValidationResult> {
  const resolvedRootPath = path.resolve(rootPath);
  const rootStat = await lstat(resolvedRootPath, { bigint: false }).catch(() => null);

  if (!rootStat?.isDirectory()) {
    return {
      rootPath: resolvedRootPath,
      allSkills: [],
      validSkills: [],
      invalidSkills: [],
      rootErrors: [`skills root is missing or not a directory: ${resolvedRootPath}`],
      rootWarnings: [],
    };
  }

  const { skillDirs, rootErrors, rootWarnings } = await collectTreeRootState(resolvedRootPath);
  const allSkills = await Promise.all(
    skillDirs.map(
      async (skillId) => await validateSkillPackage(path.join(resolvedRootPath, skillId)),
    ),
  );

  return {
    rootPath: resolvedRootPath,
    allSkills,
    validSkills: allSkills.filter((result) => result.valid),
    invalidSkills: allSkills.filter((result) => !result.valid),
    rootErrors,
    rootWarnings,
  };
}

export async function loadSkillPackage(skillPath: string): Promise<LoadedSkill> {
  const validation = await validateSkillPackage(skillPath);
  if (!validation.valid || !validation.entryMdPath || !validation.fingerprint) {
    throw new Error(
      `cannot load invalid skill package ${validation.skillId}: ${validation.errors.join('; ')}`,
    );
  }

  return {
    skillId: validation.skillId,
    workspacePath: validation.path,
    entryMdPath: validation.entryMdPath,
    entryMarkdown: await readFile(validation.entryMdPath, 'utf8'),
    fingerprint: validation.fingerprint,
    referencesPaths: [...validation.supportPaths.references],
    scriptsPaths: [...validation.supportPaths.scripts],
    assetsPaths: [...validation.supportPaths.assets],
  };
}

export async function syncSkillTreeFromSeed(input: {
  seedRootPath: string;
  workspaceRootPath: string;
}): Promise<SkillTreeSyncResult> {
  const seedRootPath = path.resolve(input.seedRootPath);
  const workspaceRootPath = path.resolve(input.workspaceRootPath);
  await assertNoSymlinkSegments(seedRootPath);
  await assertNoSymlinkSegments(workspaceRootPath);
  const seedValidation = await validateSkillTree(seedRootPath);

  if (seedValidation.rootErrors.length > 0) {
    throw new Error(seedValidation.rootErrors.join('; '));
  }

  const workspaceSkillIds = new Set(
    ((await lstat(workspaceRootPath, { bigint: false }).catch(() => null))?.isDirectory()
      ? await listVisibleEntries(workspaceRootPath)
      : []
    ).filter((entryName) => !entryName.startsWith('.')),
  );
  const copiedSkillIds = seedValidation.validSkills.map((result) => result.skillId);
  const removedSkillIds = [...workspaceSkillIds].filter(
    (skillId) => !copiedSkillIds.includes(skillId),
  );
  const workspaceParentPath = path.dirname(workspaceRootPath);
  const tempWorkspaceRootPath = path.join(
    workspaceParentPath,
    `${path.basename(workspaceRootPath)}.tmp-${randomUUID()}`,
  );
  const backupWorkspaceRootPath = path.join(
    workspaceParentPath,
    `${path.basename(workspaceRootPath)}.bak-${randomUUID()}`,
  );
  let backupCreated = false;

  await mkdir(workspaceParentPath, { recursive: true });
  await mkdir(tempWorkspaceRootPath, { recursive: true });

  try {
    for (const skillId of copiedSkillIds) {
      await cp(path.join(seedRootPath, skillId), path.join(tempWorkspaceRootPath, skillId), {
        recursive: true,
        force: true,
      });
    }

    const existingWorkspaceRoot = await lstat(workspaceRootPath).catch(() => null);
    if (existingWorkspaceRoot) {
      await rename(workspaceRootPath, backupWorkspaceRootPath);
      backupCreated = true;
    }

    await rename(tempWorkspaceRootPath, workspaceRootPath);
    if (backupCreated) {
      await rm(backupWorkspaceRootPath, { recursive: true, force: true });
    }
  } catch (error) {
    await rm(tempWorkspaceRootPath, { recursive: true, force: true });

    if (
      backupCreated &&
      (await lstat(workspaceRootPath).catch(() => null)) === null &&
      (await lstat(backupWorkspaceRootPath).catch(() => null)) !== null
    ) {
      await rename(backupWorkspaceRootPath, workspaceRootPath);
    }

    throw error;
  }

  return {
    copiedSkillIds,
    removedSkillIds,
  };
}
