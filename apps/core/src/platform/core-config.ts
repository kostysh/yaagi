import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export type CoreRuntimeConfig = {
  postgresUrl: string;
  fastModelBaseUrl: string;
  fastModelDescriptorPath: string;
  deepModelBaseUrl: string;
  poolModelBaseUrl: string;
  telegramEnabled: boolean;
  telegramBotToken: string | null;
  telegramAllowedChatIds: string[];
  telegramApiBaseUrl: string;
  seedRootPath: string;
  seedConstitutionPath: string;
  seedBodyPath: string;
  seedSkillsPath: string;
  seedModelsPath: string;
  seedDataPath: string;
  workspaceBodyPath: string;
  workspaceSkillsPath: string;
  modelsPath: string;
  dataPath: string;
  releaseEvidenceRootPath?: string;
  migrationsDir: string;
  pgBossSchema: string;
  operatorAuthPrincipalsFilePath: string | null;
  operatorAuthRateLimitWindowMs: number;
  operatorAuthRateLimitMaxRequests: number;
  host: string;
  port: number;
  bootTimeoutMs: number;
};

const DEFAULT_POSTGRES_URL = 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi';
const DEFAULT_FAST_MODEL_BASE_URL = 'http://127.0.0.1:8000/v1';
const DEFAULT_FAST_MODEL_DESCRIPTOR_PATH = 'models/base/vllm-fast-manifest.json';
const DEFAULT_DEEP_MODEL_BASE_URL = 'http://127.0.0.1:8001/v1';
const DEFAULT_POOL_MODEL_BASE_URL = 'http://127.0.0.1:8002/v1';
const DEFAULT_TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEFAULT_BOOT_TIMEOUT_MS = 60_000;
const DEFAULT_PG_BOSS_SCHEMA = 'pgboss';
const DEFAULT_SEED_ROOT_PATH = 'seed';
const DEFAULT_OPERATOR_AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_OPERATOR_AUTH_RATE_LIMIT_MAX_REQUESTS = 120;

const requireUrl = (value: string, label: string): string => {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' &&
    url.protocol !== 'https:' &&
    url.protocol !== 'postgres:' &&
    url.protocol !== 'postgresql:'
  ) {
    throw new Error(`${label} must be an http(s) or postgres URL`);
  }
  return value;
};

const normalizeFastModelBaseUrl = (value: string): string => {
  const url = new URL(value);
  if (!url.pathname.endsWith('/v1') && !url.pathname.endsWith('/v1/')) {
    url.pathname = path.posix.join(url.pathname, 'v1');
  }

  return url.toString().replace(/\/$/, '');
};

const parsePort = (value: string | undefined, label = 'YAAGI_PORT'): number => {
  if (!value) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be a valid TCP port, received ${value}`);
  }
  return port;
};

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (!value) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Boolean env value must be 'true' or 'false', received ${value}`);
};

const parseCsv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const parsePositiveInteger = (
  value: string | undefined,
  label: string,
  fallback: number,
): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer, received ${value}`);
  }
  return parsed;
};

const optionalEnvValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const resolvePath = (cwd: string, value: string | undefined, fallback: string): string =>
  path.resolve(cwd, optionalEnvValue(value) ?? fallback);

const resolveOptionalPath = (cwd: string, value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? path.resolve(cwd, trimmed) : null;
};

const resolvePathFromRoot = (
  cwd: string,
  rootPath: string,
  value: string | undefined,
  fallbackRelativePath: string,
): string =>
  path.resolve(cwd, optionalEnvValue(value) ?? path.join(rootPath, fallbackRelativePath));

const readSecretFile = (
  cwd: string,
  filePath: string | undefined,
  label: string,
): string | null => {
  if (!filePath) {
    return null;
  }

  const resolvedPath = path.resolve(cwd, filePath);
  const content = readFileSync(resolvedPath, 'utf8').trim();
  if (content.length === 0) {
    throw new Error(`${label} points to an empty secret file: ${resolvedPath}`);
  }

  return content;
};

const envSchema = z.object({
  YAAGI_POSTGRES_URL: z.string().optional(),
  YAAGI_FAST_MODEL_BASE_URL: z.string().optional(),
  YAAGI_FAST_MODEL_DESCRIPTOR_PATH: z.string().optional(),
  YAAGI_DEEP_MODEL_BASE_URL: z.string().optional(),
  YAAGI_POOL_MODEL_BASE_URL: z.string().optional(),
  YAAGI_TELEGRAM_ENABLED: z.string().optional(),
  YAAGI_TELEGRAM_BOT_TOKEN: z.string().optional(),
  YAAGI_TELEGRAM_BOT_TOKEN_FILE: z.string().optional(),
  YAAGI_TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),
  YAAGI_TELEGRAM_API_BASE_URL: z.string().optional(),
  YAAGI_SEED_ROOT_PATH: z.string().optional(),
  YAAGI_SEED_CONSTITUTION_PATH: z.string().optional(),
  YAAGI_SEED_BODY_PATH: z.string().optional(),
  YAAGI_SEED_SKILLS_PATH: z.string().optional(),
  YAAGI_SEED_MODELS_PATH: z.string().optional(),
  YAAGI_SEED_DATA_PATH: z.string().optional(),
  YAAGI_CONSTITUTION_PATH: z.string().optional(),
  YAAGI_WORKSPACE_BODY_PATH: z.string().optional(),
  YAAGI_WORKSPACE_SKILLS_PATH: z.string().optional(),
  YAAGI_MODELS_PATH: z.string().optional(),
  YAAGI_DATA_PATH: z.string().optional(),
  YAAGI_RELEASE_EVIDENCE_ROOT: z.string().optional(),
  YAAGI_MIGRATIONS_DIR: z.string().optional(),
  YAAGI_PGBOSS_SCHEMA: z.string().optional(),
  YAAGI_OPERATOR_AUTH_PRINCIPALS_FILE: z.string().optional(),
  YAAGI_OPERATOR_AUTH_RATE_LIMIT_WINDOW_MS: z.string().optional(),
  YAAGI_OPERATOR_AUTH_RATE_LIMIT_MAX_REQUESTS: z.string().optional(),
  YAAGI_HOST: z.string().optional(),
  YAAGI_PORT: z.string().optional(),
  YAAGI_BOOT_TIMEOUT_MS: z.string().optional(),
});

export function loadCoreRuntimeConfig(env: NodeJS.ProcessEnv = process.env): CoreRuntimeConfig {
  const cwd = process.cwd();
  const parsedEnv = envSchema.parse(env);
  const seedRootPath = resolvePath(cwd, parsedEnv.YAAGI_SEED_ROOT_PATH, DEFAULT_SEED_ROOT_PATH);
  const dataPath = resolvePath(cwd, parsedEnv.YAAGI_DATA_PATH, 'data');
  const telegramEnabled = parseBoolean(parsedEnv.YAAGI_TELEGRAM_ENABLED, false);
  const telegramBotToken =
    parsedEnv.YAAGI_TELEGRAM_BOT_TOKEN?.trim() ||
    readSecretFile(cwd, parsedEnv.YAAGI_TELEGRAM_BOT_TOKEN_FILE, 'YAAGI_TELEGRAM_BOT_TOKEN_FILE');
  const telegramAllowedChatIds = parseCsv(parsedEnv.YAAGI_TELEGRAM_ALLOWED_CHAT_IDS);

  if (telegramEnabled && !telegramBotToken) {
    throw new Error('YAAGI_TELEGRAM_BOT_TOKEN is required when YAAGI_TELEGRAM_ENABLED=true');
  }

  if (telegramEnabled && telegramAllowedChatIds.length === 0) {
    throw new Error(
      'YAAGI_TELEGRAM_ALLOWED_CHAT_IDS must contain at least one chat id when YAAGI_TELEGRAM_ENABLED=true',
    );
  }

  return {
    postgresUrl: requireUrl(
      parsedEnv.YAAGI_POSTGRES_URL ?? DEFAULT_POSTGRES_URL,
      'YAAGI_POSTGRES_URL',
    ),
    fastModelBaseUrl: normalizeFastModelBaseUrl(
      requireUrl(
        parsedEnv.YAAGI_FAST_MODEL_BASE_URL ?? DEFAULT_FAST_MODEL_BASE_URL,
        'YAAGI_FAST_MODEL_BASE_URL',
      ),
    ),
    fastModelDescriptorPath: resolvePathFromRoot(
      cwd,
      seedRootPath,
      parsedEnv.YAAGI_FAST_MODEL_DESCRIPTOR_PATH,
      DEFAULT_FAST_MODEL_DESCRIPTOR_PATH,
    ),
    deepModelBaseUrl: normalizeFastModelBaseUrl(
      requireUrl(
        parsedEnv.YAAGI_DEEP_MODEL_BASE_URL ?? DEFAULT_DEEP_MODEL_BASE_URL,
        'YAAGI_DEEP_MODEL_BASE_URL',
      ),
    ),
    poolModelBaseUrl: normalizeFastModelBaseUrl(
      requireUrl(
        parsedEnv.YAAGI_POOL_MODEL_BASE_URL ?? DEFAULT_POOL_MODEL_BASE_URL,
        'YAAGI_POOL_MODEL_BASE_URL',
      ),
    ),
    telegramEnabled,
    telegramBotToken,
    telegramAllowedChatIds,
    telegramApiBaseUrl: requireUrl(
      parsedEnv.YAAGI_TELEGRAM_API_BASE_URL ?? DEFAULT_TELEGRAM_API_BASE_URL,
      'YAAGI_TELEGRAM_API_BASE_URL',
    ),
    seedRootPath,
    seedConstitutionPath: resolvePathFromRoot(
      cwd,
      seedRootPath,
      parsedEnv.YAAGI_SEED_CONSTITUTION_PATH ?? parsedEnv.YAAGI_CONSTITUTION_PATH,
      'constitution/constitution.yaml',
    ),
    seedBodyPath: resolvePathFromRoot(cwd, seedRootPath, parsedEnv.YAAGI_SEED_BODY_PATH, 'body'),
    seedSkillsPath: resolvePathFromRoot(
      cwd,
      seedRootPath,
      parsedEnv.YAAGI_SEED_SKILLS_PATH,
      'skills',
    ),
    seedModelsPath: resolvePathFromRoot(
      cwd,
      seedRootPath,
      parsedEnv.YAAGI_SEED_MODELS_PATH,
      'models',
    ),
    seedDataPath: resolvePathFromRoot(cwd, seedRootPath, parsedEnv.YAAGI_SEED_DATA_PATH, 'data'),
    workspaceBodyPath: resolvePath(cwd, parsedEnv.YAAGI_WORKSPACE_BODY_PATH, 'workspace/body'),
    workspaceSkillsPath: resolvePath(
      cwd,
      parsedEnv.YAAGI_WORKSPACE_SKILLS_PATH,
      'workspace/skills',
    ),
    modelsPath: resolvePath(cwd, parsedEnv.YAAGI_MODELS_PATH, 'models'),
    dataPath,
    releaseEvidenceRootPath: resolvePath(
      cwd,
      parsedEnv.YAAGI_RELEASE_EVIDENCE_ROOT,
      path.join(dataPath, 'release-evidence'),
    ),
    migrationsDir: resolvePath(cwd, parsedEnv.YAAGI_MIGRATIONS_DIR, 'infra/migrations'),
    pgBossSchema: parsedEnv.YAAGI_PGBOSS_SCHEMA ?? DEFAULT_PG_BOSS_SCHEMA,
    operatorAuthPrincipalsFilePath: resolveOptionalPath(
      cwd,
      parsedEnv.YAAGI_OPERATOR_AUTH_PRINCIPALS_FILE,
    ),
    operatorAuthRateLimitWindowMs: parsePositiveInteger(
      parsedEnv.YAAGI_OPERATOR_AUTH_RATE_LIMIT_WINDOW_MS,
      'YAAGI_OPERATOR_AUTH_RATE_LIMIT_WINDOW_MS',
      DEFAULT_OPERATOR_AUTH_RATE_LIMIT_WINDOW_MS,
    ),
    operatorAuthRateLimitMaxRequests: parsePositiveInteger(
      parsedEnv.YAAGI_OPERATOR_AUTH_RATE_LIMIT_MAX_REQUESTS,
      'YAAGI_OPERATOR_AUTH_RATE_LIMIT_MAX_REQUESTS',
      DEFAULT_OPERATOR_AUTH_RATE_LIMIT_MAX_REQUESTS,
    ),
    host: parsedEnv.YAAGI_HOST ?? DEFAULT_HOST,
    port: parsePort(parsedEnv.YAAGI_PORT),
    bootTimeoutMs: parsePositiveInteger(
      parsedEnv.YAAGI_BOOT_TIMEOUT_MS,
      'YAAGI_BOOT_TIMEOUT_MS',
      DEFAULT_BOOT_TIMEOUT_MS,
    ),
  };
}
