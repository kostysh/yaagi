import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CoreRuntimeConfig } from '../src/platform/core-config.ts';

export async function createPerceptionTestWorkspace(): Promise<{
  root: string;
  cleanup(): Promise<void>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-perception-'));
  const directories = [
    'seed/body',
    'seed/skills',
    'seed/constitution',
    'seed/models/base',
    'seed/data/datasets',
    'seed/data/reports',
    'seed/data/snapshots',
    'workspace/body',
    'workspace/skills',
    'models',
    'data/datasets',
    'data/reports',
    'data/snapshots',
  ];

  for (const directory of directories) {
    await mkdir(path.join(root, directory), { recursive: true });
  }

  await writeFile(path.join(root, 'seed/constitution/constitution.yaml'), 'version: "1.0.0"\n');

  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export function buildPerceptionTestConfig(
  root: string,
  overrides: Partial<CoreRuntimeConfig> = {},
): CoreRuntimeConfig {
  return {
    postgresUrl: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
    fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
    telegramEnabled: false,
    telegramBotToken: null,
    telegramAllowedChatIds: [],
    telegramApiBaseUrl: 'https://api.telegram.org',
    seedRootPath: path.join(root, 'seed'),
    seedConstitutionPath: path.join(root, 'seed/constitution/constitution.yaml'),
    seedBodyPath: path.join(root, 'seed/body'),
    seedSkillsPath: path.join(root, 'seed/skills'),
    seedModelsPath: path.join(root, 'seed/models'),
    seedDataPath: path.join(root, 'seed/data'),
    workspaceBodyPath: path.join(root, 'workspace/body'),
    workspaceSkillsPath: path.join(root, 'workspace/skills'),
    modelsPath: path.join(root, 'models'),
    dataPath: path.join(root, 'data'),
    migrationsDir: path.join(root, 'infra/migrations'),
    pgBossSchema: 'pgboss',
    host: '127.0.0.1',
    port: 8787,
    bootTimeoutMs: 60_000,
    ...overrides,
  };
}
