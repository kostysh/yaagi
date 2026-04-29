import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import {
  EXECUTION_PROFILE,
  TELEGRAM_SEND_MESSAGE_RETRY_BUDGET,
  TELEGRAM_SEND_MESSAGE_TEXT_LIMIT,
  TELEGRAM_SEND_MESSAGE_TOOL,
  type BoundaryCheck,
  type ExecutiveRefusal,
  type ExecutiveRefusalReason,
  type ExecutiveVerdict,
  type ExecutionProfile,
  type TelegramSendMessageFailureReason,
  type TelegramSendMessageRefusalReason,
  type ToolInvocationRequest,
  telegramSendMessageParametersSchema,
} from '@yaagi/contracts/actions';
import {
  TELEGRAM_EGRESS_STATUS,
  createRuntimeJobEnqueuer,
  type TelegramEgressStore,
} from '@yaagi/db';
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
  telegramEgressStore?: Pick<
    TelegramEgressStore,
    | 'getStimulusContext'
    | 'getByActionId'
    | 'recordIntent'
    | 'recordRefusal'
    | 'markSending'
    | 'markSent'
    | 'markRetryScheduled'
    | 'markFailed'
  >;
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

const telegramScalarLength = (value: string): number => [...value].length;

const hashTelegramChatId = (chatId: string): string =>
  `sha256:${createHash('sha256').update(chatId).digest('hex')}`;

const sanitizeTelegramDetail = (value: unknown, token: string | null): string => {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  return token && token.length > 0 ? raw.replaceAll(token, '<telegram-token>') : raw;
};

const getTelegramPayloadString = (
  payload: Record<string, unknown>,
  key: 'chatId' | 'chatType',
): string | null => {
  const direct = payload[key];
  if (typeof direct === 'string') return direct;
  if (typeof direct === 'number') return String(direct);
  return null;
};

const getTelegramPayloadNumber = (
  payload: Record<string, unknown>,
  key: 'updateId',
): number | null => {
  const direct = payload[key];
  if (typeof direct === 'number') return direct;
  if (typeof direct === 'string' && direct.length > 0) return Number(direct);
  return null;
};

const mapTelegramApiFailure = (
  status: number,
  payload: Record<string, unknown>,
): TelegramSendMessageFailureReason => {
  if (status === 401) return 'telegram_invalid_token';
  if (status === 403) return 'telegram_bot_blocked';
  if (status === 429) return 'telegram_rate_limited';

  const errorCode = payload['error_code'];
  if (errorCode === 401) return 'telegram_invalid_token';
  if (errorCode === 403) return 'telegram_bot_blocked';
  if (errorCode === 429) return 'telegram_rate_limited';

  return 'telegram_api_error';
};

const createTelegramRefusalExecution = async (
  store: ToolGatewayOptions['telegramEgressStore'] | undefined,
  request: ToolInvocationRequest,
  reason: TelegramSendMessageRefusalReason,
  detail: string,
  input?: {
    replyToStimulusId?: string | null;
    replyToTelegramUpdateId?: number | null;
    recipientChatIdHash?: string | null;
    text?: string | null;
  },
): Promise<ToolExecutionResult> => {
  await store?.recordRefusal({
    actionId: request.actionId,
    tickId: request.tickId,
    reason,
    ...(input && input.replyToStimulusId !== undefined
      ? { replyToStimulusId: input.replyToStimulusId }
      : {}),
    ...(input && input.replyToTelegramUpdateId !== undefined
      ? { replyToTelegramUpdateId: input.replyToTelegramUpdateId }
      : {}),
    ...(input && input.recipientChatIdHash !== undefined
      ? { recipientChatIdHash: input.recipientChatIdHash }
      : {}),
    ...(input && input.text !== undefined ? { text: input.text } : {}),
  });

  return createRefusalExecution(
    request,
    createDeniedBoundaryCheck(EXECUTION_PROFILE.TELEGRAM_EGRESS, detail, `telegram.${reason}`),
    'boundary_denied',
    detail,
  );
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
  const telegramEgressStore = options.telegramEgressStore;
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
    [TELEGRAM_SEND_MESSAGE_TOOL]: {
      executionProfile: EXECUTION_PROFILE.TELEGRAM_EGRESS,
      supportedVerdictKind: 'tool_call',
      async execute({ config, request }) {
        const maybeText =
          typeof request.parametersJson['text'] === 'string'
            ? request.parametersJson['text']
            : null;
        const maybeReplyToStimulusId =
          typeof request.parametersJson['replyToStimulusId'] === 'string'
            ? request.parametersJson['replyToStimulusId']
            : null;
        const maybeReplyToTelegramUpdateId =
          typeof request.parametersJson['replyToTelegramUpdateId'] === 'number'
            ? request.parametersJson['replyToTelegramUpdateId']
            : null;

        if (!config.telegramEgressEnabled) {
          return createTelegramRefusalExecution(
            telegramEgressStore,
            request,
            'telegram_egress_disabled',
            'telegram egress is disabled by configuration',
            {
              replyToStimulusId: maybeReplyToStimulusId,
              replyToTelegramUpdateId: maybeReplyToTelegramUpdateId,
              text: maybeText,
            },
          );
        }

        if (!config.telegramOperatorChatId) {
          return createTelegramRefusalExecution(
            telegramEgressStore,
            request,
            'operator_chat_not_configured',
            'telegram egress requires YAAGI_TELEGRAM_OPERATOR_CHAT_ID',
            {
              replyToStimulusId: maybeReplyToStimulusId,
              replyToTelegramUpdateId: maybeReplyToTelegramUpdateId,
              text: maybeText,
            },
          );
        }

        const operatorChatIdHash = hashTelegramChatId(config.telegramOperatorChatId);
        if (!config.telegramAllowedChatIds.includes(config.telegramOperatorChatId)) {
          return createTelegramRefusalExecution(
            telegramEgressStore,
            request,
            'operator_chat_not_allowed',
            'telegram operator chat id is not included in YAAGI_TELEGRAM_ALLOWED_CHAT_IDS',
            {
              replyToStimulusId: maybeReplyToStimulusId,
              replyToTelegramUpdateId: maybeReplyToTelegramUpdateId,
              recipientChatIdHash: operatorChatIdHash,
              text: maybeText,
            },
          );
        }

        if (!config.telegramBotToken) {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(
              EXECUTION_PROFILE.TELEGRAM_EGRESS,
              'telegram egress requires a configured bot token',
              'telegram.bot_token',
            ),
            'execution_failed',
            'telegram egress requires a configured bot token',
          );
        }

        if (!telegramEgressStore) {
          return createRefusalExecution(
            request,
            createDeniedBoundaryCheck(
              EXECUTION_PROFILE.TELEGRAM_EGRESS,
              'telegram egress outbox store is unavailable',
              'telegram.outbox',
            ),
            'execution_failed',
            'telegram egress outbox store is unavailable',
          );
        }

        const suppliedRecipient =
          'chatId' in request.parametersJson ||
          'chat_id' in request.parametersJson ||
          'recipientChatId' in request.parametersJson;
        const parsed = telegramSendMessageParametersSchema.safeParse(request.parametersJson);
        if (!parsed.success) {
          const reason: TelegramSendMessageRefusalReason = suppliedRecipient
            ? 'non_operator_recipient'
            : typeof request.parametersJson['text'] !== 'string'
              ? 'non_text_payload'
              : telegramScalarLength(request.parametersJson['text']) >
                  TELEGRAM_SEND_MESSAGE_TEXT_LIMIT
                ? 'text_too_long'
                : 'non_text_payload';

          return createTelegramRefusalExecution(
            telegramEgressStore,
            request,
            reason,
            `telegram.sendMessage refused invalid parameters: ${reason}`,
            {
              replyToStimulusId: maybeReplyToStimulusId,
              replyToTelegramUpdateId: maybeReplyToTelegramUpdateId,
              recipientChatIdHash: operatorChatIdHash,
              text: maybeText,
            },
          );
        }

        const parameters = parsed.data;
        const stimulus = await telegramEgressStore.getStimulusContext(parameters.replyToStimulusId);
        const sourceChatId = stimulus
          ? getTelegramPayloadString(stimulus.payloadJson, 'chatId')
          : null;
        const sourceChatType = stimulus
          ? getTelegramPayloadString(stimulus.payloadJson, 'chatType')
          : null;
        const sourceUpdateId =
          parameters.replyToTelegramUpdateId ??
          (stimulus ? getTelegramPayloadNumber(stimulus.payloadJson, 'updateId') : null);

        if (
          !stimulus ||
          stimulus.sourceKind !== 'telegram' ||
          sourceChatId !== config.telegramOperatorChatId
        ) {
          return createTelegramRefusalExecution(
            telegramEgressStore,
            request,
            'non_operator_recipient',
            'telegram.sendMessage can only answer the configured operator telegram stimulus',
            {
              replyToStimulusId: parameters.replyToStimulusId,
              replyToTelegramUpdateId: sourceUpdateId,
              recipientChatIdHash: operatorChatIdHash,
              text: parameters.text,
            },
          );
        }

        if (sourceChatType !== 'private') {
          return createTelegramRefusalExecution(
            telegramEgressStore,
            request,
            'group_or_channel_context',
            'telegram.sendMessage refuses group, supergroup and channel contexts',
            {
              replyToStimulusId: parameters.replyToStimulusId,
              replyToTelegramUpdateId: sourceUpdateId,
              recipientChatIdHash: operatorChatIdHash,
              text: parameters.text,
            },
          );
        }

        const intent = await telegramEgressStore.recordIntent({
          actionId: request.actionId,
          tickId: request.tickId,
          replyToStimulusId: parameters.replyToStimulusId,
          replyToTelegramUpdateId: sourceUpdateId,
          recipientChatIdHash: operatorChatIdHash,
          text: parameters.text,
        });

        if (intent.status === TELEGRAM_EGRESS_STATUS.SENT) {
          return createAcceptedExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.TELEGRAM_EGRESS,
              'telegram.sendMessage was already sent for this action id',
            ),
            {
              status: 'sent',
              actionId: request.actionId,
              egressMessageId: intent.egressMessageId,
              telegramMessageId: intent.telegramMessageId,
              attemptCount: intent.attemptCount,
            },
          );
        }

        if (
          intent.status === TELEGRAM_EGRESS_STATUS.FAILED ||
          intent.attemptCount >= TELEGRAM_SEND_MESSAGE_RETRY_BUDGET
        ) {
          const failed = await telegramEgressStore.markFailed({
            actionId: request.actionId,
            reason: 'retry_budget_exhausted',
            errorJson: { reason: 'retry_budget_exhausted' },
          });
          return createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.TELEGRAM_EGRESS,
              'telegram.sendMessage retry budget is exhausted',
            ),
            'execution_failed',
            `telegram.sendMessage failed: retry_budget_exhausted (${failed.attemptCount} attempts)`,
          );
        }

        const sending = await telegramEgressStore.markSending(request.actionId);
        if (!sending) {
          return createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.TELEGRAM_EGRESS,
              'telegram.sendMessage send claim is already active or not yet retryable',
            ),
            'execution_failed',
            'telegram.sendMessage is already sending or not ready to retry',
          );
        }

        const durableText = getOptionalString(sending.textJson['text']);
        if (!durableText) {
          const failed = await telegramEgressStore.markFailed({
            actionId: request.actionId,
            reason: 'telegram_api_error',
            errorJson: { reason: 'missing_durable_text' },
          });
          return createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.TELEGRAM_EGRESS,
              'telegram.sendMessage durable outbox row is missing text',
            ),
            'execution_failed',
            `telegram.sendMessage failed: telegram_api_error (${failed.attemptCount} attempts)`,
          );
        }

        const telegramUrl = `${config.telegramApiBaseUrl.replace(/\/+$/, '')}/bot${config.telegramBotToken}/sendMessage`;
        const failTransport = async (
          reason: TelegramSendMessageFailureReason,
          errorJson: Record<string, unknown>,
        ): Promise<ToolExecutionResult> => {
          const terminal =
            reason === 'telegram_api_timeout' ||
            reason === 'telegram_invalid_token' ||
            reason === 'telegram_bot_blocked' ||
            sending.attemptCount >= TELEGRAM_SEND_MESSAGE_RETRY_BUDGET;
          const recorded = terminal
            ? await telegramEgressStore.markFailed({
                actionId: request.actionId,
                reason:
                  terminal && sending.attemptCount >= TELEGRAM_SEND_MESSAGE_RETRY_BUDGET
                    ? 'retry_budget_exhausted'
                    : reason,
                errorJson,
              })
            : await telegramEgressStore.markRetryScheduled({
                actionId: request.actionId,
                reason,
                errorJson,
              });
          const recordedReason = recorded.lastErrorCode ?? reason;

          return createRefusalExecution(
            request,
            createAllowedBoundaryCheck(
              EXECUTION_PROFILE.TELEGRAM_EGRESS,
              'telegram.sendMessage passed admission checks before transport failure',
            ),
            'execution_failed',
            `telegram.sendMessage failed: ${recordedReason} (${recorded.attemptCount} attempts)`,
          );
        };

        const telegramTimeout = createTimeoutController(
          DEFAULT_IO_TIMEOUT_MS,
          'telegram.sendMessage timed out',
        );
        try {
          const response = await withTimeout(
            DEFAULT_IO_TIMEOUT_MS,
            () =>
              fetchImpl(telegramUrl, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                signal: telegramTimeout.signal,
                body: JSON.stringify({
                  chat_id: config.telegramOperatorChatId,
                  text: durableText,
                }),
              }),
            () => new Error('telegram.sendMessage timed out'),
          );
          telegramTimeout.throwIfTimedOut();
          const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          const result = payload['result'];
          const telegramMessageId =
            payload['ok'] === true &&
            result &&
            typeof result === 'object' &&
            !Array.isArray(result) &&
            typeof (result as Record<string, unknown>)['message_id'] === 'number'
              ? ((result as Record<string, unknown>)['message_id'] as number)
              : null;

          if (response.ok && telegramMessageId !== null) {
            const sent = await telegramEgressStore.markSent({
              actionId: request.actionId,
              telegramMessageId,
            });
            return createAcceptedExecution(
              request,
              createAllowedBoundaryCheck(
                EXECUTION_PROFILE.TELEGRAM_EGRESS,
                'telegram.sendMessage delivered to the configured operator chat',
              ),
              {
                status: 'sent',
                actionId: request.actionId,
                egressMessageId: sent.egressMessageId,
                telegramMessageId,
                attemptCount: sent.attemptCount,
              },
            );
          }

          return failTransport(mapTelegramApiFailure(response.status, payload), {
            status: response.status,
            errorCode: payload['error_code'] ?? null,
            description: sanitizeTelegramDetail(
              payload['description'] ?? '',
              config.telegramBotToken,
            ),
          });
        } catch (error) {
          const reason = telegramTimeout.isTimeoutError(error)
            ? 'telegram_api_timeout'
            : 'telegram_api_error';
          return failTransport(reason, {
            detail: sanitizeTelegramDetail(
              error instanceof Error ? error.message : String(error),
              config.telegramBotToken,
            ),
          });
        } finally {
          telegramTimeout.dispose();
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
