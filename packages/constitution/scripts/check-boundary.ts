import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL('package.json', root), 'utf8'),
);
assert.deepEqual(manifest.exports, {
  '.': { types: './dist/index.d.ts', import: './dist/index.js' },
  './contracts': {
    types: './dist/contracts.d.ts',
    import: './dist/contracts.js',
  },
});
assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
  '@polyphony/core-types',
  'zod',
]);
assert.equal(manifest.sideEffects, false);
const eslint = new ESLint({ flags: ['unstable_native_nodejs_ts_config'] });
for (const entry of ['contracts', 'index']) {
  const probes = [
    "import 'node:fs';",
    "import '../../state/src/index.js';",
    "import '@polyphony/core-types/src/index.js';",
    "import '@polyphony/state/contracts';",
    "export type { Result } from '@polyphony/core-types';",
    "export const hidden = import('node:fs');",
  ];
  if (entry === 'contracts')
    probes.push("import { z } from 'zod';", 'export const runtime = 1;');
  else probes.push('console.log("unexpected");', 'setTimeout(() => {}, 0);');
  for (const code of probes) {
    const [result] = await eslint.lintText(code, {
      filePath: new URL(`src/${entry}.ts`, root).pathname,
    });
    assert.ok(
      result.messages.some(
        (message) =>
          message.ruleId === 'no-restricted-syntax' ||
          message.ruleId === 'no-restricted-globals',
      ),
      code,
    );
  }
}
console.log(
  'constitution boundary: exports, dependencies and negative import/I/O probes passed',
);
