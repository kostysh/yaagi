import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { BodyChangeGateCheck, BodyChangeGateKind } from '@yaagi/contracts/body-evolution';

const execFileAsync = promisify(execFile);
const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;

export type BodyEvolutionCommandSpec = {
  kind: BodyChangeGateKind;
  label: string;
  command: string;
  args: string[];
  evidenceRef?: string | null;
};

export type BodyEvolutionCommandRunner = (input: {
  worktreePath: string;
  command: BodyEvolutionCommandSpec;
}) => Promise<BodyChangeGateCheck>;

export type BodyEvolutionCommandRunnerOptions = {
  timeoutMs?: number;
  executeCommand?: (input: {
    cwd: string;
    command: string;
    args: string[];
    timeoutMs: number;
  }) => Promise<{ stdout: string; stderr: string }>;
};

const normalizeFailureDetail = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const createBodyEvolutionCommandRunner = (
  options: BodyEvolutionCommandRunnerOptions = {},
): BodyEvolutionCommandRunner => {
  const executeCommand =
    options.executeCommand ??
    (async (input: { cwd: string; command: string; args: string[]; timeoutMs: number }) => {
      const result = await execFileAsync(input.command, input.args, {
        cwd: input.cwd,
        timeout: input.timeoutMs,
        maxBuffer: 1_000_000,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
      };
    });

  return async (input) => {
    try {
      await executeCommand({
        cwd: input.worktreePath,
        command: input.command.command,
        args: input.command.args,
        timeoutMs: options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
      });

      return {
        kind: input.command.kind,
        label: input.command.label,
        ok: true,
        evidenceRef: input.command.evidenceRef ?? null,
        detail: null,
      };
    } catch (error) {
      return {
        kind: input.command.kind,
        label: input.command.label,
        ok: false,
        evidenceRef: input.command.evidenceRef ?? null,
        detail: normalizeFailureDetail(error),
      };
    }
  };
};
