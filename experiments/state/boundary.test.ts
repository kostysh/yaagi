import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ESLint } from "eslint";

test("S1 boundary: common contracts compile without Node types and import without native loads", () => {
  const contracts = new URL("./contracts.js", import.meta.url).href;
  const sqlite = new URL("./sqlite.js", import.meta.url).href;
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    `
    import { registerHooks } from 'node:module';
    registerHooks({resolve(specifier, context, next) {
      if (specifier.startsWith('node:') || specifier.includes('sqlite-vec') || specifier.includes('drizzle-orm')) throw new Error('Native import forbidden');
      return next(specifier, context);
    }});
    await import(${JSON.stringify(contracts)});
    await import(${JSON.stringify(sqlite)});
  `,
  ]);
  const declaration = readFileSync(
    new URL("./contracts.d.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(declaration, /node:|NodeJS|Buffer|DatabaseSync|SqlScope/);
});

test("S1 boundary: lint rejects Node/native imports, dynamic imports and sibling internals", async () => {
  const eslint = new ESLint();
  for (const source of [
    'import type { DatabaseSync } from "node:sqlite"; export type X = DatabaseSync;',
    'export const x = import("node:sqlite");',
    'export * from "sqlite-vec";',
    'import type { Result } from "../../packages/core-types/src/index.js"; export type X = Result<1, 2>;',
  ]) {
    const [result] = await eslint.lintText(source, {
      filePath: "contracts.ts",
    });
    assert.ok(result && result.errorCount > 0);
    assert.ok(
      result.messages.some(
        (m) =>
          m.ruleId === "no-restricted-imports" ||
          m.ruleId === "no-restricted-syntax",
      ),
    );
  }
});
