import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const GOVERNOR_TABLE_WRITE_PATTERN =
  /\b(?:insert\s+into|update|delete\s+from)\s+[^;]*development_(?:freezes|proposals|proposal_decisions|ledger)/i;

const ALLOWED_SOURCE_FILES = new Set([
  path.join(REPO_ROOT, 'packages/db/src/development-governor.ts'),
]);

const walkTypescriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return await walkTypescriptFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
    }),
  );

  return files.flat();
};

void test('AC-F0016-02 keeps governor-owned table writes behind the governor store boundary', async () => {
  const files = [
    ...(await walkTypescriptFiles(path.join(REPO_ROOT, 'apps/core/src'))),
    ...(await walkTypescriptFiles(path.join(REPO_ROOT, 'packages/db/src'))),
  ];
  const violations: string[] = [];

  for (const file of files) {
    if (ALLOWED_SOURCE_FILES.has(file)) {
      continue;
    }

    const content = await readFile(file, 'utf8');
    if (GOVERNOR_TABLE_WRITE_PATTERN.test(content)) {
      violations.push(path.relative(REPO_ROOT, file));
    }
  }

  assert.deepEqual(violations, []);
});
