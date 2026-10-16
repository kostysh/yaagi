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
    ['.', './contracts', './sqlite'].map((key) => {
      const entry = key === './sqlite' ? 'sqlite' : 'contracts';
      return [
        key,
        { types: `./dist/${entry}.d.ts`, import: `./dist/${entry}.js` },
      ];
    }),
  ),
);
assert.deepEqual(manifest.dependencies, {
  '@polyphony/core-types': 'workspace:*',
  '@polyphony/state': 'workspace:*',
  'drizzle-orm': '0.45.3',
  zod: '4.6.5',
});
const eslint = new ESLint({ flags: ['unstable_native_nodejs_ts_config'] });
for (const code of [
  "import 'node:fs';",
  "import type { SqlScope } from '@polyphony/state/adapters/sqlite';",
  "export const hidden = import('node:fs');",
  "export * from './sqlite.js';",
  "import './sqlite.js';",
]) {
  const [result] = await eslint.lintText(code, {
    filePath: new URL('src/contracts.ts', root).pathname,
  });
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === 'no-restricted-syntax',
    ),
    code,
  );
}
for (const source of [
  '@polyphony/state/src/index.js',
  '../../state/src/index.js',
  '@polyphony/core-types/dist/index.js',
]) {
  const [result] = await eslint.lintText(`import '${source}';`, {
    filePath: new URL('src/sqlite.ts', root).pathname,
  });
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === 'no-restricted-imports',
    ),
    source,
  );
}
console.log(
  'timeline boundary: public exports, dependencies and negative import probes passed',
);
