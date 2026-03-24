import { execFile } from 'node:child_process';
import { lstat, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import {
  EXECUTION_PROFILE,
  type BoundaryCheck,
  type ExecutiveRefusal,
  type ExecutiveRefusalReason,
  type ExecutiveVerdict,
  type ExecutionProfile,
  type ToolInvocationRequest,
} from '@yaagi/contracts/actions';
import { createRuntimeJobEnqueuer } from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';

const execFileAsync = promisify(execFile);
const DEFAULT_IO_TIMEOUT_MS = 1_500;
const MAX_SAFE_DATA_BYTES = 16_384;
const MAX_HTTP_BODY_BYTES = 8_192;
const MAX_READ_FILE_BYTES = 8_192;

type ShellExecutionInput = {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
};

type ShellExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type ToolHandlerContext = {
  config: CoreRuntimeConfig;
  request: ToolInvocationRequest;
};

type ToolGatewayFileOps = {
  lstat: typeof lstat;
  readFile: typeof readFile;
  realpath: typeof realpath;
  unlink: typeof unlink;
  writeFile: typeof writeFile;
};

type TimeoutController = {
  signal: AbortSignal;
  throwIfTimedOut: () => void;
  isTimeoutError: (error: unknown) => boolean;
  remainingMs: () => number;
  dispose: () => void;
};

type ToolGatewayOptions = {
  config: CoreRuntimeConfig;
  fetchImpl?: typeof fetch;
  executeShell?: (input: ShellExecutionInput) => Promise<ShellExecutionResult>;
  enqueueJob?: (
    queueName: string,
    payload: Record<string, unknown>,
    options?: { signal?: AbortSignal; timeoutMs?: number },
  ) => Promise<{ jobId: string; rollback: () => Promise<void> }>;
  fileOps?: Partial<ToolGatewayFileOps>;
};

export type ToolExecutionResult = {
  verdict: ExecutiveVerdict;
  rollback?: () => Promise<void>;
};

type ToolDefinition = {
  executionProfile: ExecutionProfile;
  supportedVerdictKind: ToolInvocationRequest['verdictKind'];
  execute(context: ToolHandlerContext): Promise<ToolExecutionResult>;
};

export type ToolGateway = {
  execute(input: ToolInvocationRequest): Promise<ToolExecutionResult>;
};

const truncateText = (value: string, limit: number): string =>
  value.length <= limit ? value : `${value.slice(0, limit)}…`;

const getOptionalString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const defaultFileOps: ToolGatewayFileOps = {
  lstat,
  readFile,
  realpath,
  unlink,
  writeFile,
};

const createAllowedBoundaryCheck = (
  executionProfile: ExecutionProfile,
  reason: string,
): BoundaryCheck => ({
  allowed: true,
  reason,
  executionProfile,
});

const createDeniedBoundaryCheck = (
  executionProfile: ExecutionProfile | undefined,
  reason: string,
  deniedBy: string,
): BoundaryCheck => ({
  allowed: false,
  reason,
  ...(executionProfile ? { executionProfile } : {}),
  deniedBy,
});

const createAcceptedVerdict = (
  request: ToolInvocationRequest,
  boundaryCheck: BoundaryCheck,
  resultJson: Record<string, unknown>,
): ExecutiveVerdict => ({
  accepted: true,
  actionId: request.actionId,
  verdictKind: request.verdictKind,
  boundaryCheck,
  resultJson,
});

const createRefusalVerdict = (
  request: ToolInvocationRequest,
  boundaryCheck: BoundaryCheck,
  refusalReason: ExecutiveRefusalReason,
  detail: string,
): ExecutiveRefusal => ({
  accepted: false,
  actionId: request.actionId,
  verdictKind: request.verdictKind,
  boundaryCheck,
  refusalReason,
  detail,
});

const createAcceptedExecution = (
  request: ToolInvocationRequest,
  boundaryCheck: BoundaryCheck,
  resultJson: Record<string, unknown>,
  rollback?: () => Promise<void>,
): ToolExecutionResult => ({
  verdict: createAcceptedVerdict(request, boundaryCheck, resultJson),
  ...(rollback ? { rollback } : {}),
});

const createRefusalExecution = (
  request: ToolInvocationRequest,
  boundaryCheck: BoundaryCheck,
  refusalReason: ExecutiveRefusalReason,
  detail: string,
): ToolExecutionResult => ({
  verdict: createRefusalVerdict(request, boundaryCheck, refusalReason, detail),
});

const isWithinPath = (basePath: string, candidatePath: string): boolean => {
  const relative = path.relative(path.resolve(basePath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const resolveExistingPathRoot = async (
  targetPath: string,
  fileOps: ToolGatewayFileOps,
  timeout?: TimeoutController,
): Promise<string> => {
  try {
    const resolvedPath = await fileOps.realpath(targetPath);
    timeout?.throwIfTimedOut();
    return resolvedPath;
  } catch {
    timeout?.throwIfTimedOut();
    return path.resolve(targetPath);
  }
};

const guardWorkspacePath = async (
  config: CoreRuntimeConfig,
  absolutePath: string,
  options: {
    label: string;
    traversalDeniedBy: string;
    symlinkDeniedBy: string;
  },
  fileOps: ToolGatewayFileOps,
  timeout?: TimeoutController,
): Promise<{ ok: true } | { ok: false; detail: string; deniedBy: string }> => {
  const workspaceRoot = await resolveExistingPathRoot(config.workspaceBodyPath, fileOps, timeout);
  const seedRoot = await resolveExistingPathRoot(config.seedRootPath, fileOps, timeout);
  const relativeToWorkspace = path.relative(path.resolve(config.workspaceBodyPath), absolutePath);
  const segments = relativeToWorkspace.split(path.sep).filter(Boolean);

  for (let index = 0; index < segments.length; index += 1) {
    const candidatePath = path.join(
      path.resolve(config.workspaceBodyPath),
      ...segments.slice(0, index + 1),
    );

    try {
      const candidateStats = await fileOps.lstat(candidatePath);
      timeout?.throwIfTimedOut();

      if (candidateStats.isSymbolicLink()) {
        return {
          ok: false,
          detail: `${options.label} traverses a forbidden symlink segment`,
          deniedBy: options.symlinkDeniedBy,
        };
      }

      const candidateRealPath = await fileOps.realpath(candidatePath);
      timeout?.throwIfTimedOut();
      if (
        !isWithinPath(workspaceRoot, candidateRealPath) ||
        isWithinPath(seedRoot, candidateRealPath)
      ) {
        return {
          ok: false,
          detail: `${options.label} escapes the writable runtime body`,
          deniedBy: options.traversalDeniedBy,
        };
      }
    } catch (error) {
      timeout?.throwIfTimedOut();
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        break;
      }

      timeout?.throwIfTimedOut();
      throw error;
    }
  }

  return { ok: true };
};

const resolveBodyPath = async (
  config: CoreRuntimeConfig,
  relativePath: string,
  fileOps: ToolGatewayFileOps,
  timeout?: TimeoutController,
): Promise<
  { ok: true; absolutePath: string } | { ok: false; detail: string; deniedBy: string }
> => {
  if (!relativePath || relativePath.trim().length === 0) {
    return {
      ok: false,
      detail: 'git_body wrapper requires a non-empty relativePath',
      deniedBy: 'git_body.path',
    };
  }

  const absolutePath = path.resolve(config.workspaceBodyPath, relativePath);
  if (isWithinPath(config.seedRootPath, absolutePath)) {
    return {
      ok: false,
      detail: `path ${relativePath} targets /seed, which is immutable for the executive seam`,
      deniedBy: 'git_body.seed',
    };
  }

  if (!isWithinPath(config.workspaceBodyPath, absolutePath)) {
    return {
      ok: false,
      detail: `path ${relativePath} escapes the materialized workspace body`,
      deniedBy: 'git_body.path',
    };
  }

  if (
    absolutePath.includes(`${path.sep}.git${path.sep}`) ||
    absolutePath.endsWith(`${path.sep}.git`)
  ) {
    return {
      ok: false,
      detail: `path ${relativePath} targets a forbidden git metadata path`,
      deniedBy: 'git_body.git_metadata',
    };
  }

  const pathGuard = await guardWorkspacePath(
    config,
    absolutePath,
    {
      label: `path ${relativePath}`,
      traversalDeniedBy: 'git_body.path',
      symlinkDeniedBy: 'git_body.symlink',
    },
    fileOps,
    timeout,
  );
  timeout?.throwIfTimedOut();
  if (!pathGuard.ok) {
    return {
      ok: false,
      detail: pathGuard.detail,
      deniedBy: pathGuard.deniedBy,
    };
  }

  return {
    ok: true,
    absolutePath,
  };
};

const validateRestrictedShellArgs = (
  config: CoreRuntimeConfig,
  cwd: string,
  args: string[],
  fileOps: ToolGatewayFileOps,
): Promise<{ ok: true } | { ok: false; detail: string; deniedBy: string }> => {
  return (async () => {
    const cwdGuard = await guardWorkspacePath(
      config,
      cwd,
      {
        label: `restricted_shell cwd ${path.relative(config.workspaceBodyPath, cwd) || '.'}`,
        traversalDeniedBy: 'restricted_shell.cwd',
        symlinkDeniedBy: 'restricted_shell.symlink',
      },
      fileOps,
    );
    if (!cwdGuard.ok) {
      return {
        ok: false,
        detail: cwdGuard.detail,
        deniedBy: cwdGuard.deniedBy,
      };
    }

    for (const arg of args) {
      if (arg.startsWith('-')) {
        continue;
      }

      const resolvedArgPath = path.resolve(cwd, arg);
      if (isWithinPath(config.seedRootPath, resolvedArgPath)) {
        return {
          ok: false,
          detail: `restricted_shell arg ${arg} targets immutable /seed content`,
          deniedBy: 'restricted_shell.args',
        };
      }

      if (!isWithinPath(config.workspaceBodyPath, resolvedArgPath)) {
        return {
          ok: false,
          detail: `restricted_shell arg ${arg} escapes the writable runtime body`,
          deniedBy: 'restricted_shell.args',
        };
      }

      const argGuard = await guardWorkspacePath(
        config,
        resolvedArgPath,
        {
          label: `restricted_shell arg ${arg}`,
          traversalDeniedBy: 'restricted_shell.args',
          symlinkDeniedBy: 'restricted_shell.symlink',
        },
        fileOps,
      );
      if (!argGuard.ok) {
        return {
          ok: false,
          detail: argGuard.detail,
          deniedBy: argGuard.deniedBy,
        };
      }
    }

    return { ok: true };
  })();
};

const withTimeout = async <T>(
  timeoutMs: number,
  run: () => Promise<T>,
  onTimeout: () => Error,
): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const createTimeoutController = (timeoutMs: number, message: string): TimeoutController => {
  const controller = new AbortController();
  const deadline = Date.now() + timeoutMs;
  const timeout = setTimeout(() => controller.abort(new Error(message)), timeoutMs);

  return {
    signal: controller.signal,
    throwIfTimedOut(): void {
      if (controller.signal.aborted) {
        const reason: unknown = controller.signal.reason;
        if (reason instanceof Error) {
          throw reason;
        }

        throw new Error(message);
      }
    },
    isTimeoutError(error: unknown): boolean {
      return error instanceof Error && error.message === message;
    },
    remainingMs(): number {
      return Math.max(1, deadline - Date.now());
    },
    dispose(): void {
      clearTimeout(timeout);
    },
  };
};

const defaultExecuteShell = async (input: ShellExecutionInput): Promise<ShellExecutionResult> => {
  try {
    const result = await execFileAsync(input.command, input.args, {
      cwd: input.cwd,
      timeout: input.timeoutMs,
      encoding: 'utf8',
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (error) {
    if (typeof error === 'object' && error !== null) {
      const executionError = error as {
        stdout?: unknown;
        stderr?: unknown;
        code?: unknown;
      };
      const stdout = typeof executionError.stdout === 'string' ? executionError.stdout : '';
      const stderr = typeof executionError.stderr === 'string' ? executionError.stderr : '';
      const exitCode = typeof executionError.code === 'number' ? executionError.code : 1;
      return {
        stdout,
        stderr,
        exitCode,
      };
    }

    throw error;
  }
};

const buildAllowedHttpHosts = (config: CoreRuntimeConfig): Set<string> => {
  const hosts = new Set<string>(['127.0.0.1', 'localhost']);

  try {
    hosts.add(new URL(config.fastModelBaseUrl).hostname);
  } catch {}

  hosts.add(config.host);

  return hosts;
};

export function createPhase0ToolGateway(options: ToolGatewayOptions): ToolGateway {
  const fetchImpl = options.fetchImpl ?? fetch;
  const executeShell = options.executeShell ?? defaultExecuteShell;
  const fileOps: ToolGatewayFileOps = {
    ...defaultFileOps,
    ...options.fileOps,
  };
  const enqueueJob =
    options.enqueueJob ??
    createRuntimeJobEnqueuer({
      connectionString: options.config.postgresUrl,
      schema: options.config.pgBossSchema,
      timeoutMs: DEFAULT_IO_TIMEOUT_MS,
    });
  const allowedHttpHosts = buildAllowedHttpHosts(options.config);

  const definitions: Record<string, ToolDefinition> = {
    'safe_data.inspect_payload': {
      executionProfile: EXECUTION_PROFILE.SAFE_DATA,
      supportedVerdictKind: 'tool_call',
      execute({ request }): Promise<ToolExecutionResult> {
        const serialized = JSON.stringify(request.parametersJson);
        if (serialized.length > MAX_SAFE_DATA_BYTES) {
          return Promise.resolve(
            createRefusalExecution(
              request,
              createDeniedBoundaryCheck(
                EXECUTION_PROFILE.SAFE_DATA,
                'safe_data payload exceeds the bounded size limit',
                'safe_data.size',
              ),
              'boundary_denied',
              `safe_data payload exceeded ${MAX_SAFE_DATA_BYTES} bytes`,
            ),
          );
        }

        return Promise.resolve(
          createAcceptedExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.SAFE_DATA,
              'safe_data.inspect_payload is allowlisted for bounded inspection',
            ),
            {
              toolName: 'safe_data.inspect_payload',
              echoedParameters: request.parametersJson,
              normalizedKeys: Object.keys(request.parametersJson).sort(),
            },
          ),
        );
      },
    },
    'git_body.read_file': {
      executionProfile: EXECUTION_PROFILE.GIT_BODY,
      supportedVerdictKind: 'tool_call',
      async execute({ config, request }) {
        const target = await resolveBodyPath(
          config,
          getOptionalString(request.parametersJson['relativePath']) ?? '',
          fileOps,
        );
        if (!target.ok) {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(EXECUTION_PROFILE.GIT_BODY, target.detail, target.deniedBy),
            'boundary_denied',
            target.detail,
          );
        }

        try {
          const content = await withTimeout(
            DEFAULT_IO_TIMEOUT_MS,
            () => readFile(target.absolutePath, 'utf8'),
            () => new Error('git_body read timed out'),
          );
          return createAcceptedExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.GIT_BODY,
              'git_body.read_file is bounded to the materialized workspace body',
            ),
            {
              toolName: 'git_body.read_file',
              relativePath: path.relative(config.workspaceBodyPath, target.absolutePath),
              content: truncateText(content, MAX_READ_FILE_BYTES),
            },
          );
        } catch (error) {
          return createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.GIT_BODY,
              'git_body.read_file passed boundary checks before execution',
            ),
            error instanceof Error && error.message === 'git_body read timed out'
              ? 'execution_timeout'
              : 'execution_failed',
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    },
    'git_body.write_file': {
      executionProfile: EXECUTION_PROFILE.GIT_BODY,
      supportedVerdictKind: 'tool_call',
      async execute({ config, request }) {
        const writeTimeout = createTimeoutController(
          DEFAULT_IO_TIMEOUT_MS,
          'git_body write timed out',
        );
        const createTimedOutRefusal = (): ToolExecutionResult =>
          createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.GIT_BODY,
              'git_body.write_file passed boundary checks before execution',
            ),
            'execution_timeout',
            'git_body write timed out',
          );
        let target: { ok: true; absolutePath: string } | null = null;
        let content = '';
        let parentPath = '';

        try {
          const resolvedTarget = await withTimeout(
            writeTimeout.remainingMs(),
            async () =>
              await resolveBodyPath(
                config,
                getOptionalString(request.parametersJson['relativePath']) ?? '',
                fileOps,
                writeTimeout,
              ),
            () => new Error('git_body write timed out'),
          );
          if (!resolvedTarget.ok) {
            return createRefusalExecution(
              request,
              createDeniedBoundaryCheck(
                EXECUTION_PROFILE.GIT_BODY,
                resolvedTarget.detail,
                resolvedTarget.deniedBy,
              ),
              'boundary_denied',
              resolvedTarget.detail,
            );
          }

          target = resolvedTarget;
          content =
            typeof request.parametersJson['content'] === 'string'
              ? request.parametersJson['content']
              : '';
          parentPath = path.dirname(target.absolutePath);
          const parentStats = await withTimeout(
            writeTimeout.remainingMs(),
            async () => await fileOps.lstat(parentPath),
            () => new Error('git_body write timed out'),
          );
          if (writeTimeout.signal.aborted) {
            return createTimedOutRefusal();
          }
          if (!parentStats.isDirectory()) {
            return createRefusalExecution(
              request,
              createDeniedBoundaryCheck(
                EXECUTION_PROFILE.GIT_BODY,
                'git_body.write_file requires an existing directory parent inside the workspace body',
                'git_body.parent',
              ),
              'boundary_denied',
              `git_body parent ${path.relative(config.workspaceBodyPath, parentPath) || '.'} is not a directory`,
            );
          }
        } catch (error) {
          if (writeTimeout.signal.aborted) {
            return createTimedOutRefusal();
          }
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ENOENT'
          ) {
            return createRefusalExecution(
              request,
              createDeniedBoundaryCheck(
                EXECUTION_PROFILE.GIT_BODY,
                'git_body.write_file requires an existing parent directory inside the workspace body',
                'git_body.parent',
              ),
              'boundary_denied',
              `git_body parent ${path.relative(config.workspaceBodyPath, parentPath) || '.'} must exist before writing`,
            );
          }

          throw error;
        }

        try {
          if (!target) {
            throw new Error('git_body target resolution did not complete');
          }
          let previousContent: string | null = null;
          let hadExistingFile = false;
          try {
            previousContent = await fileOps.readFile(target.absolutePath, {
              encoding: 'utf8',
              signal: writeTimeout.signal,
            });
            writeTimeout.throwIfTimedOut();
            hadExistingFile = true;
          } catch (error) {
            writeTimeout.throwIfTimedOut();
            if (
              !(
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'ENOENT'
              )
            ) {
              throw error;
            }
          }
          await fileOps.writeFile(target.absolutePath, content, {
            encoding: 'utf8',
            signal: writeTimeout.signal,
          });
          writeTimeout.throwIfTimedOut();
          return createAcceptedExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.GIT_BODY,
              'git_body.write_file is bounded to the writable runtime body',
            ),
            {
              toolName: 'git_body.write_file',
              relativePath: path.relative(config.workspaceBodyPath, target.absolutePath),
              bytesWritten: Buffer.byteLength(content, 'utf8'),
            },
            async () => {
              if (hadExistingFile) {
                await fileOps.writeFile(target.absolutePath, previousContent ?? '', 'utf8');
                return;
              }

              await fileOps.unlink(target.absolutePath).catch(() => {});
            },
          );
        } catch (error) {
          return createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.GIT_BODY,
              'git_body.write_file passed boundary checks before execution',
            ),
            writeTimeout.isTimeoutError(error) ? 'execution_timeout' : 'execution_failed',
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          writeTimeout.dispose();
        }
      },
    },
    'network_http.get': {
      executionProfile: EXECUTION_PROFILE.NETWORK_HTTP,
      supportedVerdictKind: 'tool_call',
      async execute({ request }) {
        const rawUrl = request.parametersJson['url'];
        if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(
              EXECUTION_PROFILE.NETWORK_HTTP,
              'network_http.get requires a bounded url string',
              'network_http.url',
            ),
            'boundary_denied',
            'network_http.get requires a non-empty url',
          );
        }

        let targetUrl: URL;
        try {
          targetUrl = new URL(rawUrl);
        } catch (error) {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(
              EXECUTION_PROFILE.NETWORK_HTTP,
              'network_http.get rejected an invalid url',
              'network_http.url',
            ),
            'boundary_denied',
            error instanceof Error ? error.message : String(error),
          );
        }

        const method = (getOptionalString(request.parametersJson['method']) ?? 'GET').toUpperCase();
        if (method !== 'GET') {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(
              EXECUTION_PROFILE.NETWORK_HTTP,
              'network_http.get only allows GET in the first-wave profile',
              'network_http.method',
            ),
            'boundary_denied',
            `network_http.get refused method ${method}`,
          );
        }

        if (!allowedHttpHosts.has(targetUrl.hostname)) {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(
              EXECUTION_PROFILE.NETWORK_HTTP,
              `host ${targetUrl.hostname} is not on the bounded allowlist`,
              'network_http.host',
            ),
            'boundary_denied',
            `network_http host ${targetUrl.hostname} is not allowlisted`,
          );
        }

        try {
          const controller = new AbortController();
          const response = await withTimeout(
            DEFAULT_IO_TIMEOUT_MS,
            async () => {
              const timeout = setTimeout(() => controller.abort(), DEFAULT_IO_TIMEOUT_MS);
              try {
                return await fetchImpl(targetUrl, {
                  method: 'GET',
                  signal: controller.signal,
                });
              } finally {
                clearTimeout(timeout);
              }
            },
            () => new Error('network_http.get timed out'),
          );
          const bodyText = truncateText(await response.text(), MAX_HTTP_BODY_BYTES);

          return createAcceptedExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.NETWORK_HTTP,
              `network_http.get allowlisted host ${targetUrl.hostname} matched the boundary policy`,
            ),
            {
              toolName: 'network_http.get',
              url: targetUrl.toString(),
              status: response.status,
              ok: response.ok,
              bodyText,
            },
          );
        } catch (error) {
          return createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.NETWORK_HTTP,
              `network_http.get matched allowlisted host ${targetUrl.hostname} before execution`,
            ),
            error instanceof Error && error.message === 'network_http.get timed out'
              ? 'execution_timeout'
              : 'execution_failed',
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    },
    'restricted_shell.exec': {
      executionProfile: EXECUTION_PROFILE.RESTRICTED_SHELL,
      supportedVerdictKind: 'tool_call',
      async execute({ config, request }) {
        const command = getOptionalString(request.parametersJson['command']) ?? '';
        const args = Array.isArray(request.parametersJson['args'])
          ? request.parametersJson['args'].filter(
              (value): value is string => typeof value === 'string',
            )
          : [];
        const relativeCwd =
          typeof request.parametersJson['cwd'] === 'string' ? request.parametersJson['cwd'] : '.';
        const cwd = path.resolve(config.workspaceBodyPath, relativeCwd);

        if (!['pwd', 'ls'].includes(command)) {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(
              EXECUTION_PROFILE.RESTRICTED_SHELL,
              `command ${command} is outside the bounded restricted_shell allowlist`,
              'restricted_shell.command',
            ),
            'boundary_denied',
            `restricted_shell refused command ${command}`,
          );
        }

        if (
          !isWithinPath(config.workspaceBodyPath, cwd) ||
          isWithinPath(config.seedRootPath, cwd)
        ) {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(
              EXECUTION_PROFILE.RESTRICTED_SHELL,
              'restricted_shell cwd escaped the writable runtime body',
              'restricted_shell.cwd',
            ),
            'boundary_denied',
            `restricted_shell cwd ${relativeCwd} is outside the workspace body`,
          );
        }

        const argsCheck = await validateRestrictedShellArgs(config, cwd, args, fileOps);
        if (!argsCheck.ok) {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(
              EXECUTION_PROFILE.RESTRICTED_SHELL,
              argsCheck.detail,
              argsCheck.deniedBy,
            ),
            'boundary_denied',
            argsCheck.detail,
          );
        }

        try {
          const result = await executeShell({
            command,
            args,
            cwd,
            timeoutMs: DEFAULT_IO_TIMEOUT_MS,
          });
          if (result.exitCode !== 0) {
            return createRefusalExecution(
              request,
              createAllowedBoundaryCheck(
                EXECUTION_PROFILE.RESTRICTED_SHELL,
                `restricted_shell command ${command} passed boundary checks before execution`,
              ),
              'execution_failed',
              truncateText(result.stderr || `command exited with ${result.exitCode}`, 1_024),
            );
          }

          return createAcceptedExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.RESTRICTED_SHELL,
              `restricted_shell command ${command} is allowlisted inside the workspace body`,
            ),
            {
              toolName: 'restricted_shell.exec',
              command,
              args,
              cwd: path.relative(config.workspaceBodyPath, cwd) || '.',
              stdout: truncateText(result.stdout, 4_096),
              stderr: truncateText(result.stderr, 4_096),
            },
          );
        } catch (error) {
          return createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.RESTRICTED_SHELL,
              `restricted_shell command ${command} passed boundary checks before execution`,
            ),
            'execution_timeout',
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    },
    'job_enqueue.phase0_followup': {
      executionProfile: EXECUTION_PROFILE.JOB_ENQUEUE,
      supportedVerdictKind: 'schedule_job',
      async execute({ request }) {
        const enqueueTimeout = createTimeoutController(
          DEFAULT_IO_TIMEOUT_MS,
          'job_enqueue.phase0_followup timed out',
        );
        try {
          const jobName = 'phase0.executive.followup';
          const { jobId, rollback } = await enqueueJob(jobName, request.parametersJson, {
            signal: enqueueTimeout.signal,
            timeoutMs: DEFAULT_IO_TIMEOUT_MS,
          });
          enqueueTimeout.throwIfTimedOut();
          return createAcceptedExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.JOB_ENQUEUE,
              'job_enqueue.phase0_followup is allowlisted on the canonical pg-boss substrate',
            ),
            {
              toolName: 'job_enqueue.phase0_followup',
              jobName,
              jobId,
            },
            rollback,
          );
        } catch (error) {
          return createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.JOB_ENQUEUE,
              'job_enqueue.phase0_followup passed boundary checks before enqueue',
            ),
            enqueueTimeout.isTimeoutError(error) ? 'execution_timeout' : 'execution_failed',
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          enqueueTimeout.dispose();
        }
      },
    },
  };

  return {
    execute(input: ToolInvocationRequest): Promise<ToolExecutionResult> {
      const definition = input.toolName ? definitions[input.toolName] : undefined;
      if (!definition) {
        return Promise.resolve(
          createRefusalExecution(
            input,
            createDeniedBoundaryCheck(
              undefined,
              `tool ${input.toolName ?? '<missing>'} is not in the first-wave allowlist`,
              'tool_allowlist',
            ),
            'unsupported_tool',
            `tool ${input.toolName ?? '<missing>'} is not supported by the phase-0 Tool Gateway`,
          ),
        );
      }

      if (definition.supportedVerdictKind !== input.verdictKind) {
        return Promise.resolve(
          createRefusalExecution(
            input,
            createDeniedBoundaryCheck(
              definition.executionProfile,
              `${input.toolName} is not allowlisted for ${input.verdictKind}`,
              'tool_kind_mismatch',
            ),
            'unsupported_tool',
            `${input.toolName} may only be used as ${definition.supportedVerdictKind}`,
          ),
        );
      }

      return definition.execute({
        config: options.config,
        request: input,
      });
    },
  };
}
