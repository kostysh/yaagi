import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

type RootPackageJson = {
  scripts: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const escapeRegExp = (value: string): string => value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getScript = (rootPackageJson: RootPackageJson, scriptName: string): string => {
  const script = rootPackageJson.scripts[scriptName];
  if (script === undefined) {
    throw new Error(`${scriptName} must be defined`);
  }
  return script;
};

void test('AC-F0002-07 exposes canonical quality and style commands for source and test code', async () => {
  const rootPackageJson = JSON.parse(
    await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as RootPackageJson;
  const biomeConfig = JSON.parse(await readFile(path.join(repoRoot, 'biome.json'), 'utf8')) as {
    $schema?: string;
    files?: {
      ignoreUnknown?: boolean;
      includes?: string[];
    };
    formatter?: {
      indentStyle?: string;
      lineWidth?: number;
    };
    javascript?: {
      formatter?: {
        quoteStyle?: string;
      };
    };
    assist?: {
      enabled?: boolean;
      actions?: {
        source?: {
          organizeImports?: string;
        };
      };
    };
  };
  const eslintConfig = await readFile(path.join(repoRoot, 'eslint.config.js'), 'utf8');
  const eslintTsconfig = JSON.parse(
    await readFile(path.join(repoRoot, 'tsconfig.eslint.json'), 'utf8'),
  ) as {
    include?: string[];
  };

  assert.equal(rootPackageJson.devDependencies?.['@biomejs/biome'] !== undefined, true);
  assert.equal(rootPackageJson.devDependencies?.['eslint'] !== undefined, true);
  assert.equal(rootPackageJson.devDependencies?.['@eslint/js'] !== undefined, true);
  assert.equal(rootPackageJson.devDependencies?.['@typescript-eslint/parser'] !== undefined, true);
  assert.equal(
    rootPackageJson.devDependencies?.['@typescript-eslint/eslint-plugin'] !== undefined,
    true,
  );
  assert.equal(rootPackageJson.devDependencies?.['globals'] !== undefined, true);
  const formatScript = getScript(rootPackageJson, 'format');
  const formatCheckScript = getScript(rootPackageJson, 'format:check');
  const lintScript = getScript(rootPackageJson, 'lint');
  const lintFixScript = getScript(rootPackageJson, 'lint:fix');

  assert.match(formatScript, /^biome format --files-ignore-unknown=true --write /);
  assert.match(
    formatCheckScript,
    /^biome check --files-ignore-unknown=true --formatter-enabled=true --linter-enabled=false --assist-enabled=false /,
  );
  assert.match(
    lintScript,
    /^biome lint --files-ignore-unknown=true --diagnostic-level=warn --error-on-warnings .* && eslint /,
  );
  assert.match(
    lintFixScript,
    /^biome lint --files-ignore-unknown=true --diagnostic-level=warn --error-on-warnings --write .* && eslint --fix /,
  );

  const sharedTargets = [
    'apps',
    'packages',
    'infra',
    'scripts',
    'test',
    'package.json',
    'tsconfig.json',
    'tsconfig.base.json',
    'tsconfig.typecheck.json',
    'tsconfig.eslint.json',
    'biome.json',
    'eslint.config.js',
  ];

  for (const target of sharedTargets) {
    const targetPattern = new RegExp(`\\b${target.replaceAll('.', '\\.')}\\b`);

    assert.match(formatScript, targetPattern);
    assert.match(formatCheckScript, targetPattern);
    assert.match(lintScript, targetPattern);
    assert.match(lintFixScript, targetPattern);
  }

  const eslintTargets = [
    'apps/**/*.ts',
    'packages/**/*.ts',
    'infra/**/*.ts',
    'test/**/*.ts',
    'eslint.config.js',
  ];

  for (const target of eslintTargets) {
    const targetPattern = new RegExp(escapeRegExp(`"${target}"`));

    assert.match(lintScript, targetPattern);
    assert.match(lintFixScript, targetPattern);
  }

  assert.equal(biomeConfig.$schema, 'https://biomejs.dev/schemas/latest/schema.json');
  assert.equal(biomeConfig.files?.ignoreUnknown, false);
  assert.equal(Array.isArray(biomeConfig.files?.includes), true);
  assert.equal(biomeConfig.formatter?.indentStyle, 'space');
  assert.equal(biomeConfig.formatter?.lineWidth, 100);
  assert.equal(biomeConfig.javascript?.formatter?.quoteStyle, 'single');
  assert.equal(biomeConfig.assist?.enabled, true);
  assert.equal(biomeConfig.assist?.actions?.source?.organizeImports, 'on');
  assert.match(eslintConfig, /recommended-type-checked/);
  assert.match(eslintConfig, /tsconfig\.eslint\.json/);
  assert.match(eslintConfig, /scripts\/\*\*\/\*\.map/);
  assert.deepEqual(
    biomeConfig.files?.includes?.filter((entry) => entry.startsWith('!scripts/')),
    ['!scripts/**/*.map'],
  );
  assert.deepEqual(eslintTsconfig.include, [
    'apps/**/*.ts',
    'packages/**/*.ts',
    'infra/**/*.ts',
    'test/**/*.ts',
  ]);
});

void test('AC-F0002-08 preserves the canonical gate order format then typecheck then lint for source and test workflows', async () => {
  const rootPackageJson = JSON.parse(
    await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as RootPackageJson;
  const qualityFixSteps = getScript(rootPackageJson, 'quality:fix').split(' && ');
  const qualityCheckSteps = getScript(rootPackageJson, 'quality:check').split(' && ');

  assert.deepEqual(qualityFixSteps, ['pnpm format', 'pnpm typecheck', 'pnpm lint']);
  assert.deepEqual(qualityCheckSteps, ['pnpm format:check', 'pnpm typecheck', 'pnpm lint']);
});
