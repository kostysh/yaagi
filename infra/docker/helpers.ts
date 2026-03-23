import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ExecFileOptionsWithStringEncoding } from 'node:child_process';

const execFileAsync = promisify(execFile);

export function infraRoot(): string {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
}

export function repoRoot(): string {
  return path.resolve(infraRoot(), '..');
}

export async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

type RunOptions = ExecFileOptionsWithStringEncoding & {
  rejectOnNonZeroExitCode?: boolean;
};

export async function run(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const { rejectOnNonZeroExitCode = true, ...execOptions } = options;

  try {
    const result = await execFileAsync(command, args, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      ...execOptions,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    if (rejectOnNonZeroExitCode) {
      throw error;
    }

    const failedResult = error as {
      stdout?: string;
      stderr?: string;
    };

    return {
      stdout: failedResult.stdout ?? '',
      stderr: failedResult.stderr ?? '',
    };
  }
}

export async function createTempProject(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'yaagi-infra-'));
}

export async function removePath(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true });
}

export async function waitForHttp(
  url: string,
  timeoutMs = 60_000,
  intervalMs = 250,
): Promise<Response> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`timeout waiting for ${url}`);
}
