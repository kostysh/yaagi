import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';

const manifestUrl = new URL('../package.json', import.meta.url);
const manifest: { exports?: Record<string, Record<string, unknown>> } =
  JSON.parse(await readFile(manifestUrl, 'utf8'));

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'bundledDependencies',
  'bundleDependencies',
];

for (const field of dependencyFields) {
  if (Object.hasOwn(manifest, field)) {
    throw new Error(`package.json must not define ${field}`);
  }
}

const exportKeys = Object.keys(manifest.exports ?? {});

if (exportKeys.length !== 1 || exportKeys[0] !== '.') {
  throw new Error('package.json must expose exactly one root export named "."');
}

const rootExport = manifest.exports?.['.'];
const rootExportKeys = Object.keys(rootExport ?? {}).sort();

if (
  rootExportKeys.length !== 2 ||
  rootExportKeys[0] !== 'import' ||
  rootExportKeys[1] !== 'types' ||
  rootExport?.import !== './dist/index.js' ||
  rootExport?.types !== './dist/index.d.ts'
) {
  throw new Error(
    'the root export must expose only dist/index.js and dist/index.d.ts',
  );
}

const eslint = new ESLint({ flags: ['unstable_native_nodejs_ts_config'] });
for (const code of [
  "import 'node:fs';",
  "import '../../state/src/index.js';",
  "import './hidden.js';",
  "export { hidden } from './hidden.js';",
  "export const hidden = import('node:fs');",
]) {
  const [result] = await eslint.lintText(code, {
    filePath: new URL('../src/boundary-probe.ts', import.meta.url).pathname,
  });
  if (
    !result.messages.some(
      (message) => message.ruleId === 'no-restricted-syntax',
    )
  ) {
    throw new Error(`Source dependency prohibition did not reject: ${code}`);
  }
}
