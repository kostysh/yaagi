import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL('package.json', root), 'utf8'),
);
assert.deepEqual(
  manifest.exports,
  Object.fromEntries(
    ['contracts', 'sqlite', 'node'].map((name) => [
      `./${name}`,
      { types: `./dist/${name}.d.ts`, import: `./dist/${name}.js` },
    ]),
  ),
);
assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
  '@polyphony/core-types',
  'sqlite-vec',
  'zod',
]);
for (const name of [
  'format',
  'format:check',
  'lint',
  'typecheck',
  'build',
  'test',
  'test:integration',
])
  assert.equal(typeof manifest.scripts[name], 'string');

const eslint = new ESLint({ flags: ['unstable_native_nodejs_ts_config'] });
for (const code of [
  "import type { DatabaseSync } from 'node:sqlite'; export type Leak = DatabaseSync;",
  "import 'sqlite-vec';",
  "export type { SqlScope } from './sqlite.js';",
  "export const native = import('node:sqlite');",
]) {
  const [result] = await eslint.lintText(code, {
    filePath: new URL('src/contracts.ts', root).pathname,
  });
  assert.ok(result.messages.some((m) => m.ruleId === 'no-restricted-syntax'));
}
for (const path of [
  '@polyphony/core-types/src/index.js',
  '../../core-types/src/index.js',
]) {
  const [result] = await eslint.lintText(`import '${path}';`, {
    filePath: new URL('src/node.ts', root).pathname,
  });
  assert.ok(result.messages.some((m) => m.ruleId === 'no-restricted-imports'));
}
console.log(
  'state boundary: exports, dependencies and negative import probes passed',
);
