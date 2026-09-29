import assert from 'node:assert/strict';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { openState } from './fixture.js';
import { writeOwners } from '../examples/owners.js';
import { counts, failure, fixture, limits, value } from './fixture.js';

test('callback errors that resemble OS/SQLite failures stay callback_failed and do not close storage', async (t) => {
  const { store } = await fixture(t);
  for (const fields of [
    { code: 'EACCES' },
    { errcode: 11 },
    { code: 'ENOSPC' },
  ]) {
    failure(
      await store.transact(async (scope) => {
        await writeOwners(scope);
        throw Object.assign(new Error('SECRET owner data'), fields);
      }, limits()),
      'callback_failed',
    );
    assert.deepEqual(
      value(await store.readSnapshot(async (scope) => counts(scope), limits())),
      [0, 0, 0],
    );
  }
  failure(
    await store.readSnapshot(async () => {
      throw { errcode: 13 };
    }, limits()),
    'callback_failed',
  );
  value(await store.checkSchema(limits()));
  failure(
    await store.transact(async (scope) => {
      try {
        await scope.run('INSERT INTO absent VALUES(1)');
      } catch {
        throw Object.assign(new Error('owner wrapper'), { code: 'EACCES' });
      }
      return { ok: true, value: undefined };
    }, limits()),
    'operation_failed',
  );
});

test('sqlitex owner names are included in the schema fingerprint and unknown-schema rejection', async (t) => {
  const migrations = [
    { id: 'owner', sql: 'CREATE TABLE sqlitex_owner(value);' },
  ];
  const f = await fixture(t, migrations);
  const raw = new DatabaseSync(f.path);
  try {
    raw.exec('ALTER TABLE sqlitex_owner ADD COLUMN drift');
  } finally {
    raw.close();
  }
  failure(await f.store.checkSchema(limits()), 'incompatible');
  failure(await f.store.readSnapshot(async () => 0, limits()), 'incompatible');
  failure(
    await openState({ path: f.path, migrations }, limits()),
    'incompatible',
  );
  const path = join(f.dir, 'unknown.db');
  const unknown = new DatabaseSync(path);
  unknown.exec('CREATE TABLE sqlitex_unknown(value)');
  unknown.close();
  chmodSync(path, 0o600);
  failure(await openState({ path, migrations: [] }, limits()), 'incompatible');
});

test('migration connection control, including END, cannot commit partial DDL/data/journal', async (t) => {
  for (const control of [
    'END',
    'END TRANSACTION',
    'COMMIT',
    'ROLLBACK',
    'BEGIN',
    'SAVEPOINT owner',
    'RELEASE owner',
    "ATTACH ':memory:' AS other",
    'DETACH other',
    'PRAGMA user_version=9',
  ]) {
    const migrations = [
      {
        id: 'first',
        sql: 'CREATE TABLE original(value); INSERT INTO original VALUES(1);',
      },
      {
        id: 'second',
        sql: `CREATE TABLE partial(value); UPDATE original SET value=2; ${control};`,
      },
    ];
    const f = await fixture(t, migrations, false);
    failure(await f.store.migrate(limits()), 'incompatible');
    assert.deepEqual(value(await f.store.checkSchema(limits())), {
      applied: 0,
      pending: 2,
    });
    value(await f.store.close());
    const raw = new DatabaseSync(f.path);
    try {
      assert.deepEqual(raw.prepare('SELECT name FROM sqlite_schema').all(), []);
    } finally {
      raw.close();
    }
  }
});

test('migration data literals, CASE, trigger BEGIN/END and comments are not connection control', async (t) => {
  const { store } = await fixture(t, [
    {
      id: 'valid',
      sql: `
    CREATE TABLE owner_data(value TEXT);
    CREATE TABLE owner_events(value TEXT);
    CREATE TRIGGER owner_insert AFTER INSERT ON owner_data BEGIN
      INSERT INTO owner_events VALUES(NEW.value);
    END;
    -- BEGIN COMMIT RELEASE END are harmless words in this comment.
    INSERT INTO owner_data VALUES('release');
    UPDATE owner_data SET value=CASE WHEN value='release' THEN 'commit' ELSE 'rollback' END;
  `,
    },
  ]);
  assert.deepEqual(
    value(
      await store.readSnapshot(
        async (scope) => ({
          rows: await scope.all('SELECT value FROM owner_data'),
          events: await scope.all('SELECT value FROM owner_events'),
        }),
        limits(),
      ),
    ),
    { rows: [['commit']], events: [['release']] },
  );
});
