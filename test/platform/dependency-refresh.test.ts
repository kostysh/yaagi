import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createPhase0Mastra, loadCoreRuntimeConfig } from '../../apps/core/src/platform/index.ts';
import { createFilesystemAdapter } from '../../apps/core/src/perception/filesystem-adapter.ts';
import { sensorSignalSchema } from '../../packages/contracts/src/perception.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const readJson = async <T>(relativePath: string): Promise<T> =>
  JSON.parse(await readFile(path.join(repoRoot, relativePath), 'utf8')) as T;

// Covers: AC-F0006-01, AC-F0006-02, AC-F0006-06
void test('AC-F0006-01 фиксирует полный direct dependency verdict и explicit Mastra-to-AI-SDK migration target', async () => {
  const rootPackageJson = await readJson<PackageJson>('package.json');
  const corePackageJson = await readJson<PackageJson>('apps/core/package.json');
  const contractsPackageJson = await readJson<PackageJson>('packages/contracts/package.json');
  const dbPackageJson = await readJson<PackageJson>('packages/db/package.json');
  const coreDependencies: Record<string, string | undefined> = corePackageJson.dependencies ?? {};
  const dossier = await readFile(
    path.join(
      repoRoot,
      'docs/features/F-0006-baseline-dependency-refresh-and-toolchain-alignment.md',
    ),
    'utf8',
  );

  assert.deepEqual(rootPackageJson.devDependencies, {
    '@biomejs/biome': '^2.4.8',
    '@eslint/js': '^10.0.1',
    '@types/node': '^25.5.0',
    '@types/pg': '^8.20.0',
    '@typescript-eslint/eslint-plugin': '^8.57.1',
    '@typescript-eslint/parser': '^8.57.1',
    eslint: '^10.1.0',
    globals: '^17.4.0',
    typescript: '^5.9.3',
  });

  assert.deepEqual(coreDependencies, {
    '@mastra/core': '^1.15.0',
    '@yaagi/contracts': 'workspace:*',
    '@yaagi/db': 'workspace:*',
    chokidar: '^5.0.0',
    hono: '^4.12.9',
    zod: '^4.3.6',
  });
  assert.equal(Object.hasOwn(coreDependencies, 'ai'), false);
  assert.equal(Object.hasOwn(coreDependencies, '@ai-sdk/openai-compatible'), false);

  assert.deepEqual(contractsPackageJson.dependencies, {
    zod: '^4.3.6',
  });

  assert.deepEqual(dbPackageJson.dependencies, {
    '@yaagi/contracts': 'workspace:*',
    pg: '^8.20.0',
    'pg-boss': '^12.14.0',
  });

  assert.match(
    dossier,
    /\| `@mastra\/core` \| `apps\/core` dependency \| `1\.15\.0` \| `1\.15\.0` \| `remove` \| high \|/,
  );
  assert.match(
    dossier,
    /\| `ai` \| `apps\/core` dependency \| `not installed` \| `6\.0\.138` \| `6\.0\.138` \| medium \|/,
  );
  assert.match(
    dossier,
    /\| `@ai-sdk\/openai-compatible` \| `apps\/core` dependency \| `not installed` \| `2\.0\.37` \| `2\.0\.37` \| medium \|/,
  );
  assert.match(
    dossier,
    /direct dependency set for `apps\/core` must move from `@mastra\/core` to `ai` \+ `@ai-sdk\/openai-compatible`/,
  );
});

// Covers: AC-F0006-03
void test('AC-F0006-03 keeps the historical runtime surfaces green while the AI SDK compatibility target is explicitly recorded', async () => {
  const dossier = await readFile(
    path.join(
      repoRoot,
      'docs/features/F-0006-baseline-dependency-refresh-and-toolchain-alignment.md',
    ),
    'utf8',
  );
  const parsedSignal = sensorSignalSchema.parse({
    source: 'http',
    signalType: 'dependency.refresh.probe',
    payload: {},
  });

  assert.equal(parsedSignal.source, 'http');

  const config = loadCoreRuntimeConfig({
    YAAGI_TELEGRAM_ENABLED: 'false',
  });
  const mastra = createPhase0Mastra(config);
  assert.equal(Object.keys(mastra.listAgents()).includes('phase0DecisionAgent'), true);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yaagi-f0006-'));
  const statuses: string[] = [];
  const adapter = createFilesystemAdapter({
    emitSignal: () => Promise.resolve(undefined),
    reportStatus: (snapshot) => {
      statuses.push(snapshot.status);
    },
    watchPaths: [tempRoot],
    repoRoot: tempRoot,
  });

  try {
    await adapter.start();
    await sleep(50);
    assert.equal(adapter.snapshot().status, 'healthy');
    await adapter.stop();
    assert.equal(adapter.snapshot().status, 'disabled');
    assert.deepEqual(statuses.slice(-2), ['healthy', 'disabled']);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }

  assert.match(dossier, /`ai 6\.0\.138` считается обязательной целевой версией/);
  assert.match(
    dossier,
    /`@ai-sdk\/openai-compatible 2\.0\.37` считается обязательной целевой версией/,
  );
  assert.match(dossier, /`@mastra\/core 1\.15\.0` больше не является допустимым target dependency/);
});

// Covers: AC-F0006-04, AC-F0006-05
void test('AC-F0006-04 сохраняет канонический verification contract, а AC-F0006-05 фиксирует AI SDK runtime verdict в документации', async () => {
  const rootPackageJson = await readJson<PackageJson>('package.json');
  const readme = await readFile(path.join(repoRoot, 'README.md'), 'utf8');
  const runtimeAdr = await readFile(
    path.join(repoRoot, 'docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md'),
    'utf8',
  );
  const substrateAdr = await readFile(
    path.join(repoRoot, 'docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md'),
    'utf8',
  );
  const dossier = await readFile(
    path.join(
      repoRoot,
      'docs/features/F-0006-baseline-dependency-refresh-and-toolchain-alignment.md',
    ),
    'utf8',
  );

  assert.equal(
    rootPackageJson.scripts?.['quality:fix'],
    'pnpm format && pnpm typecheck && pnpm lint',
  );
  assert.equal(
    rootPackageJson.scripts?.['test'],
    'node --experimental-strip-types --experimental-test-module-mocks --test',
  );
  assert.equal(
    rootPackageJson.scripts?.['smoke:cell'],
    'node --experimental-strip-types --test infra/docker/deployment-cell.smoke.ts',
  );

  assert.match(readme, /runtime baseline: `Node\.js 22 \+ TypeScript`/);
  assert.match(readme, /AI SDK is used as the thin reasoning and model-integration substrate/);
  assert.match(readme, /canonical automation gate: `pnpm quality:check`/);
  assert.match(readme, /containerized phase-0 smoke verification: `pnpm smoke:cell`/);
  assert.match(runtimeAdr, /runtime: `Node\.js 22`/);
  assert.match(runtimeAdr, /package manager: `pnpm`/);
  assert.match(substrateAdr, /Status: Accepted/);
  assert.match(
    substrateAdr,
    /Канонический reasoning\/model-integration substrate репозитория меняется с `Mastra` на `AI SDK`/,
  );

  assert.match(dossier, /status: planned/);
  assert.match(dossier, /AC-F0006-04/);
  assert.match(dossier, /AC-F0006-05/);
  assert.match(
    dossier,
    /ADR-F0006-04 Runtime substrate migration is part of the dependency baseline/,
  );
  assert.match(
    dossier,
    /README\.md.*ADR-2026-03-25-ai-sdk-runtime-substrate\.md.*выровнены по новому repo-level runtime contract/,
  );
});
