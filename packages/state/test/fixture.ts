import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { Result } from '@polyphony/core-types';
import type { OperationOptions, StorageCode } from '@polyphony/state/contracts';
import { createState } from '@polyphony/state';
import {
  createSqliteAdapter,
  type SqlMigration,
  type SqlScope,
} from '@polyphony/state/adapters/sqlite';

export async function openState(
  config: Parameters<typeof createSqliteAdapter>[0],
  options: OperationOptions,
) {
  const result = await createSqliteAdapter(config, options);
  if (!result.ok) return result;
  return {
    ok: true,
    value: {
      ...createState(result.value, (scope) => scope),
      adapter: result.value,
    },
  } as const;
}
type TestState = Extract<
  Awaited<ReturnType<typeof openState>>,
  { ok: true }
>['value'];

export const limits = (
  signal: AbortSignal = new AbortController().signal,
  timeoutMs = 5_000,
): OperationOptions => ({ signal, timeoutMs });
export const release: readonly SqlMigration[] = [
  '0000_initial',
  '0001_tag',
  '0002_vectors_and_transform',
].map((id) => ({
  id,
  sql: readFileSync(
    new URL(`../../test/migrations/${id}.sql`, import.meta.url),
    'utf8',
  ),
}));
export function value<T, E>(result: Result<T, E>): T {
  if (!result.ok) assert.fail(JSON.stringify(result));
  return result.value;
}
export function failure(
  result: Result<unknown, unknown>,
  code: StorageCode,
): void {
  assert.deepEqual(result, { ok: false, error: { kind: 'storage', code } });
}
export async function fixture(
  t: TestContext,
  migrations = release,
  migrate = true,
) {
  const dir = mkdtempSync(join(tmpdir(), 'yaagi-state-public-'));
  const path = join(dir, 'state.db');
  const stores: TestState[] = [];
  const open = async (chain = migrations) => {
    const store = value(await openState({ path, migrations: chain }, limits()));
    stores.push(store);
    return store;
  };
  t.after(async () => {
    for (const store of stores) value(await store.close());
    rmSync(dir, { recursive: true, force: true });
  });
  const store = await open();
  if (migrate) value(await store.migrate(limits()));
  return { dir, path, store, open };
}
export const counts = (scope: SqlScope) =>
  Promise.all(
    ['fixture_notes', 'fixture_marks', 'fixture_vectors'].map(
      async (table) => (await scope.all(`SELECT count(*) FROM ${table}`))[0][0],
    ),
  );
