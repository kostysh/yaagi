import path from 'node:path';
import { z } from 'zod';

export type CoreRuntimeConfig = {
  postgresUrl: string;
  fastModelBaseUrl: string;
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
  migrationsDir: string;
  pgBossSchema: string;
  host: string;
  port: number;
  bootTimeoutMs: number;
};

const DEFAULT_POSTGRES_URL = 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi';
const DEFAULT_FAST_MODEL_BASE_URL = 'http://127.0.0.1:8000/v1';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEFAULT_BOOT_TIMEOUT_MS = 60_000;
const DEFAULT_PG_BOSS_SCHEMA = 'pgboss';
const DEFAULT_SEED_ROOT_PATH = 'seed';

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

const resolvePath = (cwd: string, value: string | undefined, fallback: string): string =>
  path.resolve(cwd, value ?? fallback);

const resolvePathFromRoot = (
  cwd: string,
  rootPath: string,
  value: string | undefined,
  fallbackRelativePath: string,
): string => path.resolve(cwd, value ?? path.join(rootPath, fallbackRelativePath));

const envSchema = z.object({
  YAAGI_POSTGRES_URL: z.string().optional(),
  YAAGI_FAST_MODEL_BASE_URL: z.string().optional(),
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
  YAAGI_MIGRATIONS_DIR: z.string().optional(),
  YAAGI_PGBOSS_SCHEMA: z.string().optional(),
  YAAGI_HOST: z.string().optional(),
  YAAGI_PORT: z.string().optional(),
  YAAGI_BOOT_TIMEOUT_MS: z.string().optional(),
});

export function loadCoreRuntimeConfig(env: NodeJS.ProcessEnv = process.env): CoreRuntimeConfig {
  const cwd = process.cwd();
  const parsedEnv = envSchema.parse(env);
  const seedRootPath = resolvePath(cwd, parsedEnv.YAAGI_SEED_ROOT_PATH, DEFAULT_SEED_ROOT_PATH);

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
    dataPath: resolvePath(cwd, parsedEnv.YAAGI_DATA_PATH, 'data'),
    migrationsDir: resolvePath(cwd, parsedEnv.YAAGI_MIGRATIONS_DIR, 'infra/migrations'),
    pgBossSchema: parsedEnv.YAAGI_PGBOSS_SCHEMA ?? DEFAULT_PG_BOSS_SCHEMA,
    host: parsedEnv.YAAGI_HOST ?? DEFAULT_HOST,
    port: parsePort(parsedEnv.YAAGI_PORT),
    bootTimeoutMs: parsePositiveInteger(
      parsedEnv.YAAGI_BOOT_TIMEOUT_MS,
      'YAAGI_BOOT_TIMEOUT_MS',
      DEFAULT_BOOT_TIMEOUT_MS,
    ),
  };
}
