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
    ['index', 'contracts', 'ports', 'adapters/agenda', 'storage/sqlite'].map(
      (name) => [
        name === 'index' ? '.' : `./${name}`,
        { types: `./dist/${name}.d.ts`, import: `./dist/${name}.js` },
      ],
    ),
  ),
);
assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
  '@polyphony/core-types',
  '@polyphony/state',
  'agenda',
  'drizzle-orm',
  'zod',
]);
assert.equal(manifest.dependencies.agenda, '6.2.6');
const eslint = new ESLint({ flags: ['unstable_native_nodejs_ts_config'] });
for (const file of [
  'src/contracts.ts',
  'src/ports.ts',
  'src/index.ts',
  'src/internal/store.ts',
]) {
  for (const code of [
    "import 'agenda';",
    "import type { DatabaseSync } from 'node:sqlite'; export type Leak = DatabaseSync;",
    "export const hidden = import('node:fs');",
    "export type { Job } from 'agenda';",
    "import '../adapters/agenda.js';",
  ]) {
    const [result] = await eslint.lintText(code, {
      filePath: new URL(file, root).pathname,
    });
    assert.ok(
      result.messages.some(
        (message) => message.ruleId === 'no-restricted-syntax',
      ),
      `${file}: ${code}`,
    );
  }
}
for (const source of [
  '@polyphony/state/src/index.js',
  '../../state/src/index.js',
  '@polyphony/core-types/dist/index.js',
]) {
  const [result] = await eslint.lintText(`import '${source}';`, {
    filePath: new URL('src/storage/sqlite.ts', root).pathname,
  });
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === 'no-restricted-imports',
    ),
  );
}
console.log(
  'queue boundary: exports, pinned dependencies and negative import probes passed',
);
