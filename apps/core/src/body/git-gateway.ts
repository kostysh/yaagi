import { execFile } from 'node:child_process';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';

const execFileAsync = promisify(execFile);
const DEFAULT_GIT_TIMEOUT_MS = 20_000;

type GitExecutionInput = {
  cwd: string;
  args: string[];
};

type GitExecutionResult = {
  stdout: string;
  stderr: string;
};

type GitWorktreeEntry = {
  worktreePath: string;
  branchRef: string | null;
};

type BodyGitFileOps = {
  lstat: typeof lstat;
  mkdir: typeof mkdir;
  realpath: typeof realpath;
};

export type BodyEvolutionGitGateway = {
  createWorktree(input: { branchName: string; worktreePath: string }): Promise<void>;
  findCommittedCandidate(input: {
    worktreePath: string;
    message: string;
  }): Promise<{ commitSha: string } | null>;
  commitCandidate(input: { worktreePath: string; message: string }): Promise<{ commitSha: string }>;
  createStableTag(input: {
    worktreePath: string;
    snapshotId: string;
    commitSha: string;
  }): Promise<{ gitTag: string }>;
};

export type BodyEvolutionGitGatewayOptions = {
  config: CoreRuntimeConfig;
  timeoutMs?: number;
  executeGit?: (input: GitExecutionInput) => Promise<GitExecutionResult>;
  fileOps?: Partial<BodyGitFileOps>;
};

const defaultFileOps: BodyGitFileOps = {
  lstat,
  mkdir,
  realpath,
};

const isWithinPath = (basePath: string, candidatePath: string): boolean => {
  const relative = path.relative(path.resolve(basePath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const getErrorCode = (error: unknown): string | null =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;

const resolveExistingPathRoot = async (
  targetPath: string,
  fileOps: BodyGitFileOps,
): Promise<string> => {
  try {
    return await fileOps.realpath(targetPath);
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') {
      throw error;
    }

    return path.resolve(targetPath);
  }
};

const validateWorktreePath = async (
  config: CoreRuntimeConfig,
  worktreePath: string,
  fileOps: BodyGitFileOps,
): Promise<void> => {
  const workspaceRoot = await resolveExistingPathRoot(config.workspaceBodyPath, fileOps);
  const seedRoot = await resolveExistingPathRoot(config.seedBodyPath, fileOps);
  const absoluteWorktreePath = path.resolve(worktreePath);

  if (
    !isWithinPath(workspaceRoot, absoluteWorktreePath) ||
    isWithinPath(seedRoot, absoluteWorktreePath)
  ) {
    throw new Error('worktree path escapes the materialized writable body');
  }

  if (
    absoluteWorktreePath.includes(`${path.sep}.git${path.sep}`) ||
    absoluteWorktreePath.endsWith(`${path.sep}.git`)
  ) {
    throw new Error('worktree path targets forbidden git metadata');
  }

  const relativeToWorkspace = path.relative(
    path.resolve(config.workspaceBodyPath),
    absoluteWorktreePath,
  );
  const segments = relativeToWorkspace.split(path.sep).filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    const segmentPath = path.join(
      path.resolve(config.workspaceBodyPath),
      ...segments.slice(0, index + 1),
    );

    try {
      const stats = await fileOps.lstat(segmentPath);
      if (stats.isSymbolicLink()) {
        throw new Error('worktree path traverses a symlink inside the writable body');
      }

      const realSegmentPath = await fileOps.realpath(segmentPath);
      if (
        !isWithinPath(workspaceRoot, realSegmentPath) ||
        isWithinPath(seedRoot, realSegmentPath)
      ) {
        throw new Error('worktree path escapes the materialized writable body');
      }
    } catch (error) {
      if (getErrorCode(error) === 'ENOENT') {
        break;
      }

      throw error;
    }
  }
};

const defaultExecuteGit =
  (timeoutMs: number) =>
  async (input: GitExecutionInput): Promise<GitExecutionResult> => {
    const result = await execFileAsync('git', input.args, {
      cwd: input.cwd,
      timeout: timeoutMs,
      maxBuffer: 1_000_000,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  };

export const createBodyEvolutionStableTagName = (snapshotId: string): string =>
  `stable/${snapshotId.replace(/[^a-zA-Z0-9._/-]+/g, '-')}`;

const normalizeCommitMessage = (value: string): string => value.replace(/\s+$/, '');

const parseWorktreeList = (stdout: string): GitWorktreeEntry[] =>
  stdout
    .trim()
    .split('\n\n')
    .filter((entry) => entry.trim().length > 0)
    .map((entry) => {
      const lines = entry.split('\n');
      const worktreeLine = lines.find((line) => line.startsWith('worktree '));
      const branchLine = lines.find((line) => line.startsWith('branch '));
      if (!worktreeLine) {
        throw new Error('git worktree list returned an entry without worktree path');
      }

      return {
        worktreePath: worktreeLine.slice('worktree '.length),
        branchRef: branchLine ? branchLine.slice('branch '.length) : null,
      };
    });

export const createBodyEvolutionGitGateway = (
  options: BodyEvolutionGitGatewayOptions,
): BodyEvolutionGitGateway => {
  const fileOps: BodyGitFileOps = {
    ...defaultFileOps,
    ...options.fileOps,
  };
  const executeGit =
    options.executeGit ?? defaultExecuteGit(options.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS);

  const runGit = async (cwd: string, args: string[]): Promise<GitExecutionResult> =>
    await executeGit({ cwd, args });

  const listWorktrees = async (): Promise<GitWorktreeEntry[]> => {
    const result = await runGit(options.config.workspaceBodyPath, [
      'worktree',
      'list',
      '--porcelain',
    ]);
    return parseWorktreeList(result.stdout);
  };

  const branchExists = async (branchName: string): Promise<boolean> =>
    await runGit(options.config.workspaceBodyPath, [
      'show-ref',
      '--verify',
      '--quiet',
      `refs/heads/${branchName}`,
    ])
      .then(() => true)
      .catch(() => false);

  return {
    async createWorktree(input) {
      await validateWorktreePath(options.config, input.worktreePath, fileOps);
      const absoluteWorktreePath = path.resolve(input.worktreePath);
      const branchRef = `refs/heads/${input.branchName}`;
      const existingWorktrees = await listWorktrees();
      const existingWorktreeAtPath = existingWorktrees.find(
        (entry) => path.resolve(entry.worktreePath) === absoluteWorktreePath,
      );
      if (existingWorktreeAtPath) {
        if (existingWorktreeAtPath.branchRef === branchRef) {
          return;
        }

        throw new Error(
          `worktree path ${input.worktreePath} is already attached to ${existingWorktreeAtPath.branchRef ?? 'a detached worktree'}`,
        );
      }

      const existingWorktreeForBranch = existingWorktrees.find(
        (entry) => entry.branchRef === branchRef,
      );
      if (existingWorktreeForBranch) {
        throw new Error(
          `branch ${input.branchName} is already attached to ${existingWorktreeForBranch.worktreePath}`,
        );
      }

      await fileOps.mkdir(path.dirname(input.worktreePath), { recursive: true });
      if (await branchExists(input.branchName)) {
        await runGit(options.config.workspaceBodyPath, [
          'worktree',
          'add',
          input.worktreePath,
          input.branchName,
        ]);
        return;
      }

      await runGit(options.config.workspaceBodyPath, [
        'worktree',
        'add',
        '-b',
        input.branchName,
        input.worktreePath,
        'HEAD',
      ]);
    },

    async findCommittedCandidate(input) {
      await validateWorktreePath(options.config, input.worktreePath, fileOps);
      const headMessage = await runGit(input.worktreePath, ['log', '-1', '--pretty=%B']);
      if (normalizeCommitMessage(headMessage.stdout) !== normalizeCommitMessage(input.message)) {
        return null;
      }

      const revision = await runGit(input.worktreePath, ['rev-parse', 'HEAD']);
      return {
        commitSha: revision.stdout.trim(),
      };
    },

    async commitCandidate(input) {
      await validateWorktreePath(options.config, input.worktreePath, fileOps);
      await runGit(input.worktreePath, ['add', '-A']);
      const status = await runGit(input.worktreePath, ['status', '--porcelain']);
      if (status.stdout.trim().length === 0) {
        const existingCommit = await this.findCommittedCandidate(input);
        if (existingCommit) {
          return existingCommit;
        }

        throw new Error('candidate commit requires at least one staged change');
      }
      await runGit(input.worktreePath, ['commit', '-m', input.message]);
      const revision = await runGit(input.worktreePath, ['rev-parse', 'HEAD']);

      return {
        commitSha: revision.stdout.trim(),
      };
    },

    async createStableTag(input) {
      await validateWorktreePath(options.config, input.worktreePath, fileOps);
      const gitTag = createBodyEvolutionStableTagName(input.snapshotId);
      const existingTag = await runGit(input.worktreePath, [
        'rev-parse',
        '--verify',
        `refs/tags/${gitTag}`,
      ]).catch(() => null);
      if (existingTag) {
        const existingCommit = existingTag.stdout.trim();
        if (existingCommit !== input.commitSha) {
          throw new Error(`stable tag ${gitTag} already points at ${existingCommit}`);
        }

        return {
          gitTag,
        };
      }

      await runGit(input.worktreePath, ['tag', gitTag, input.commitSha]);
      return {
        gitTag,
      };
    },
  };
};
