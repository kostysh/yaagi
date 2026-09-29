import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

test('S1 boundary: common contracts compile without Node types and import without native loads', () => {
  execFileSync(process.execPath, [
    fileURLToPath(new URL('./contracts-import-child.js', import.meta.url)),
  ]);
  const declaration = readFileSync(
    new URL('./contracts.d.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(declaration, /node:|NodeJS|Buffer|DatabaseSync|SqlScope/);
});

test('S1 boundary: lint rejects Node/native imports, dynamic imports and sibling internals', async () => {
  const eslint = new ESLint({ flags: ['unstable_native_nodejs_ts_config'] });
  for (const source of [
    'import type { DatabaseSync } from "node:sqlite"; export type X = DatabaseSync;',
    'export const x = import("node:sqlite");',
    'export * from "sqlite-vec";',
    'import type { Result } from "../../packages/core-types/src/index.js"; export type X = Result<1, 2>;',
  ]) {
    const [result] = await eslint.lintText(source, {
      filePath: 'contracts.ts',
    });
    assert.ok(result && result.errorCount > 0);
    assert.ok(
      result.messages.some(
        (m) =>
          m.ruleId === 'no-restricted-imports' ||
          m.ruleId === 'no-restricted-syntax',
      ),
    );
  }
});
