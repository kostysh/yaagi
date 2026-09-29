// Copyable consumer recipe: public imports only, no state test/private helpers.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import type { Result } from '@polyphony/core-types';
import { createState } from '@polyphony/state';
import {
  createSqliteAdapter,
  type SqlMigration,
  type SqlScope,
} from '@polyphony/state/adapters/sqlite';
import type { StoragePort } from '@polyphony/state/contracts';

// Teaching schema, not a model for a production domain. A real consumer loads
// its reviewed release artifacts here instead of substituting a test schema.
const initial: SqlMigration = {
  id: '0000_notes',
  sql: 'CREATE TABLE example_notes(id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL);',
};
const upgrade: SqlMigration = {
  id: '0001_tag',
  sql: `ALTER TABLE example_notes ADD COLUMN tag TEXT;
        UPDATE example_notes SET tag = 'imported';`,
};
const limits = () => ({
  signal: new AbortController().signal,
  timeoutMs: 5_000, // This test's budget, not a state default.
});
function value<T, E>(result: Result<T, E>): T {
  assert.ok(result.ok, 'Expected a successful operation');
  return result.value;
}

test('consumer SQL: explicit path, parameter binding, commit, owner rollback and reopen', async (t) => {
  const temporary = mkdtempSync(join(tmpdir(), 'state-consumer-sql-'));
  const directory = join(temporary, 'private');
  mkdirSync(directory, { mode: 0o700 });
  // The application may supply an absolute path; a relative path is resolved
  // from process.cwd() at open, not from the state package directory.
  const path = relative(process.cwd(), join(directory, 'notes.db'));
  const stores: StoragePort<SqlScope>[] = [];
  t.after(async () => {
    for (const store of stores) value(await store.close());
    rmSync(temporary, { recursive: true, force: true });
  });
  const open = async () => {
    const adapter = value(
      await createSqliteAdapter({ path, migrations: [initial] }, limits()),
    );
    const state = createState(adapter, (scope) => scope);
    stores.push(state);
    return state;
  };

  const state = await open();
  assert.deepEqual(value(await state.checkSchema(limits())), {
    applied: 0,
    pending: 1,
  });
  value(await state.migrate(limits()));
  value(
    await state.transact(async (sql) => {
      const inserted = await sql.run(
        'INSERT INTO example_notes(id, body) VALUES (?, ?)',
        ['n1', "O'Reilly"],
      );
      assert.equal(inserted.changes, 1);
      return { ok: true, value: undefined };
    }, limits()),
  );
  const denied = await state.transact(async (sql) => {
    await sql.run('UPDATE example_notes SET body = ? WHERE id = ?', [
      'discard',
      'n1',
    ]);
    return { ok: false, error: 'owner-conflict' };
  }, limits());
  assert.deepEqual(denied, {
    ok: false,
    error: { kind: 'owner', error: 'owner-conflict' },
  });
  value(await state.close());

  const reopened = await open();
  assert.deepEqual(
    value(
      await reopened.readSnapshot(
        (sql) => sql.all('SELECT id, body FROM example_notes ORDER BY id'),
        limits(),
      ),
    ),
    [['n1', "O'Reilly"]],
  );
});

test('consumer migration: upgrade populated data, repeat and rollback a failed pending batch', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'state-consumer-migration-'));
  const path = join(directory, 'notes.db');
  const stores: StoragePort<SqlScope>[] = [];
  t.after(async () => {
    for (const store of stores) value(await store.close());
    rmSync(directory, { recursive: true, force: true });
  });
  const open = async (migrations: readonly SqlMigration[]) => {
    const adapter = value(
      await createSqliteAdapter({ path, migrations }, limits()),
    );
    const state = createState(adapter, (scope) => scope);
    stores.push(state);
    return state;
  };

  const previous = await open([initial]);
  value(await previous.migrate(limits()));
  value(
    await previous.transact(async (sql) => {
      await sql.run('INSERT INTO example_notes(id, body) VALUES (?, ?)', [
        'n1',
        'preserved',
      ]);
      return { ok: true, value: undefined };
    }, limits()),
  );
  value(await previous.close());

  const current = await open([initial, upgrade]);
  assert.deepEqual(value(await current.checkSchema(limits())), {
    applied: 1,
    pending: 1,
  });
  assert.deepEqual(
    await current.readSnapshot((sql) => sql.all('SELECT 1'), limits()),
    { ok: false, error: { kind: 'storage', code: 'incompatible' } },
  );
  value(await current.migrate(limits()));
  value(await current.migrate(limits())); // A repeated migration is harmless.
  value(await current.close());

  const failing = await open([
    initial,
    upgrade,
    { id: '0002_pending', sql: "UPDATE example_notes SET body = 'discard';" },
    { id: '0003_broken', sql: 'INSERT INTO missing_table VALUES (1);' },
  ]);
  assert.deepEqual(await failing.migrate(limits()), {
    ok: false,
    error: { kind: 'storage', code: 'operation_failed' },
  });
  value(await failing.close());

  const reopened = await open([initial, upgrade]);
  assert.deepEqual(value(await reopened.checkSchema(limits())), {
    applied: 2,
    pending: 0,
  });
  assert.deepEqual(
    value(
      await reopened.readSnapshot(
        (sql) => sql.all('SELECT id, body, tag FROM example_notes ORDER BY id'),
        limits(),
      ),
    ),
    [['n1', 'preserved', 'imported']],
  );
  value(await reopened.close());
  assert.deepEqual(
    await createSqliteAdapter(
      {
        path,
        migrations: [{ ...initial, sql: `${initial.sql}\n-- edited` }, upgrade],
      },
      limits(),
    ),
    { ok: false, error: { kind: 'storage', code: 'incompatible' } },
  );
});
