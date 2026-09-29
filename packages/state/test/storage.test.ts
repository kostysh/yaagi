import assert from 'node:assert/strict';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import type { OperationOptions } from '@polyphony/state/contracts';
import { openState } from './fixture.js';
import type { SqlScope } from '@polyphony/state/adapters/sqlite';
import { eq } from 'drizzle-orm';
import {
  marks,
  Note,
  notes,
  ownerDb,
  vector,
  writeOwners,
} from '../examples/owners.js';
import { counts, failure, fixture, limits, release, value } from './fixture.js';

test('public exports: two owners, BLOB and real vec0 commit together and survive reopen', async (t) => {
  const f = await fixture(t);
  value(
    await f.store.transact(async (scope) => {
      await writeOwners(scope);
      return { ok: true, value: undefined };
    }, limits()),
  );
  value(await f.store.close());
  const reopened = await f.open();
  const dto = value(
    await reopened.readSnapshot(async (scope) => {
      assert.deepEqual(await counts(scope), [1, 1, 1]);
      const db = ownerDb(scope);
      assert.equal('transaction' in db, false);
      const note = await db.select().from(notes).where(eq(notes.id, 'n')).get();
      assert.equal(
        await db.select().from(notes).where(eq(notes.id, 'missing')).get(),
        undefined,
      );
      assert.equal((await db.select().from(marks).get())?.amount, 0);
      const nearest = await scope.all(
        'SELECT rowid,distance FROM fixture_vectors WHERE embedding MATCH ? AND k = ?',
        [vector, 1n],
      );
      assert.deepEqual(nearest, [[1, 0]]);
      return Note.parse(note);
    }, limits()),
  );
  assert.equal(dto.text, 'fixture');
  assert.deepEqual(dto.bytes, new Uint8Array([0, 255, 128, 42]));
});

test('falsy/undefined results and lossless integer/BLOB normalization', async (t) => {
  const { store } = await fixture(t);
  for (const payload of [false, 0, '', null, undefined]) {
    assert.equal(
      value(
        await store.transact(
          async () => ({ ok: true, value: payload }),
          limits(),
        ),
      ),
      payload,
    );
  }
  value(
    await store.readSnapshot(async (scope) => {
      assert.deepEqual(
        await scope.all('SELECT ?,?,?,?', [
          9223372036854775807n,
          1n,
          1.5,
          new Uint8Array([0, 255]),
        ]),
        [[9223372036854775807n, 1, 1.5, new Uint8Array([0, 255])]],
      );
      return undefined;
    }, limits()),
  );
  for (const invalid of [NaN, Infinity, 9223372036854775808n]) {
    failure(
      await store.transact(async (scope) => {
        await scope.all('SELECT ?', [invalid]);
        return { ok: true, value: 0 };
      }, limits()),
      'operation_failed',
    );
  }
});

test('await retains its transaction; overlapping operations work and close drains; handles expire', async (t) => {
  const { store } = await fixture(t);
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  let saved: SqlScope | undefined;
  const pending = store.transact(async (scope) => {
    saved = scope;
    await writeOwners(scope);
    entered.resolve();
    await resume.promise;
    assert.deepEqual(await counts(scope), [1, 1, 1]);
    return { ok: true, value: false };
  }, limits());
  await entered.promise;
  assert.deepEqual(
    value(await store.readSnapshot(counts, limits())),
    [0, 0, 0],
  );
  const second = store.transact(async () => ({ ok: true, value: 0 }), limits());
  const migration = store.migrate(limits());
  value(await store.checkSchema(limits()));
  const closing = store.close();
  failure(await store.checkSchema(limits()), 'closed');
  resume.resolve();
  assert.equal(value(await pending), false);
  assert.equal(value(await second), 0);
  value(await migration);
  value(await closing);
  assert.ok(saved);
  await assert.rejects(saved.all('SELECT 1'), /scope_ended/);
  await assert.rejects(saved.run('DELETE FROM fixture_notes'), /scope_ended/);
});

test('throw, owner failure, constraint and automatic rollback poison the whole commit without replay', async (t) => {
  const { store, open } = await fixture(t);
  let calls = 0;
  failure(
    await store.transact(async (scope) => {
      calls++;
      await writeOwners(scope);
      throw new Error('SECRET SQL/path');
    }, limits()),
    'callback_failed',
  );
  const conflict = { reason: 'conflict' };
  assert.deepEqual(
    await store.transact(async (scope) => {
      await writeOwners(scope);
      return { ok: false, error: conflict };
    }, limits()),
    { ok: false, error: { kind: 'owner', error: conflict } },
  );
  for (const sql of [
    'INSERT INTO fixture_notes SELECT * FROM fixture_notes',
    'INSERT OR ROLLBACK INTO fixture_notes SELECT * FROM fixture_notes',
    'COMMIT',
    'SAVEPOINT owner',
    "SELECT load_extension('/untrusted.so')",
  ]) {
    failure(
      await store.transact(async (scope) => {
        await writeOwners(scope);
        await assert.rejects(scope.run(sql));
        await assert.rejects(
          scope.run("UPDATE fixture_notes SET text='escaped'"),
        );
        return { ok: true, value: 0 };
      }, limits()),
      'operation_failed',
    );
  }
  assert.equal(calls, 1);
  value(await store.close());
  assert.deepEqual(
    value(
      await (await open()).readSnapshot(
        async (scope) => counts(scope),
        limits(),
      ),
    ),
    [0, 0, 0],
  );
});

test('owner revision conflict rolls back both owners and vector work', async (t) => {
  const { store } = await fixture(t);
  value(
    await store.transact(async (scope) => {
      await writeOwners(scope);
      return { ok: true, value: 0 };
    }, limits()),
  );
  const result = await store.transact(async (scope) => {
    await writeOwners(scope, 'second', 2n);
    const updated = await scope.run(
      'UPDATE fixture_notes SET revision=revision+1 WHERE id=? AND revision=?',
      ['n', 99],
    );
    if (updated.changes === 0) return { ok: false, error: 'conflict' };
    return { ok: true, value: undefined };
  }, limits());
  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'owner', error: 'conflict' },
  });
  assert.deepEqual(
    value(await store.readSnapshot(async (scope) => counts(scope), limits())),
    [1, 1, 1],
  );
});

test('snapshot stays consistent across await and another connection committing', async (t) => {
  const { store, open } = await fixture(t);
  const other = await open();
  const result = value(
    await store.readSnapshot(async (scope) => {
      const before = await counts(scope);
      value(
        await other.transact(async (writer) => {
          await writeOwners(writer);
          return { ok: true, value: 0 };
        }, limits()),
      );
      return { before, after: await counts(scope) };
    }, limits()),
  );
  assert.deepEqual(result, { before: [0, 0, 0], after: [0, 0, 0] });
  assert.deepEqual(
    value(await store.readSnapshot(async (scope) => counts(scope), limits())),
    [1, 1, 1],
  );
  failure(
    await store.readSnapshot(
      async (scope) => await scope.run('DELETE FROM fixture_marks'),
      limits(),
    ),
    'write_failed',
  );
});

test('required budgets reject before callback and storage I/O; live cancellation cannot commit', async (t) => {
  const f = await fixture(t);
  const invalidPath = join(f.dir, 'must-not-exist.db');
  for (const bad of [
    undefined,
    null,
    {},
    { signal: {}, timeoutMs: 100 },
    { signal: { aborted: false }, timeoutMs: 100 },
    { signal: new AbortController().signal, timeoutMs: NaN },
    { signal: new AbortController().signal, timeoutMs: Infinity },
    { signal: new AbortController().signal, timeoutMs: -1 },
  ]) {
    // Deliberately cross the untyped caller boundary.
    failure(
      await openState(
        { path: invalidPath, migrations: [] },
        bad as OperationOptions,
      ),
      'incompatible',
    );
    let called = false;
    failure(
      await f.store.readSnapshot(async () => {
        called = true;
      }, bad as OperationOptions),
      'incompatible',
    );
    failure(
      await f.store.transact(async () => {
        called = true;
        return { ok: true, value: 0 };
      }, bad as OperationOptions),
      'incompatible',
    );
    failure(await f.store.checkSchema(bad as OperationOptions), 'incompatible');
    failure(await f.store.migrate(bad as OperationOptions), 'incompatible');
    failure(
      await f.store.adapter.backupTo(invalidPath, bad as OperationOptions),
      'incompatible',
    );
    assert.equal(called, false);
  }
  assert.equal(existsSync(invalidPath), false);
  const aborted = AbortSignal.abort('SECRET');
  failure(
    await openState({ path: invalidPath, migrations: [] }, limits(aborted)),
    'cancelled',
  );
  failure(
    await openState(
      { path: invalidPath, migrations: [] },
      limits(undefined, 0),
    ),
    'deadline',
  );
  assert.equal(existsSync(invalidPath), false);
  const controller = new AbortController();
  failure(
    await f.store.transact(async (scope) => {
      await writeOwners(scope);
      await Promise.resolve();
      controller.abort('SECRET');
      return { ok: true, value: 'not committed' };
    }, limits(controller.signal)),
    'cancelled',
  );
  assert.deepEqual(
    value(await f.store.readSnapshot(async (scope) => counts(scope), limits())),
    [0, 0, 0],
  );
  value(await f.store.close()); // cleanup has no cancellable options
  value(await f.store.close());
  failure(await f.store.checkSchema(limits()), 'closed');
});

test('worker SQL leaves timers responsive; expired budget rolls back without a late commit', async (t) => {
  const { store } = await fixture(t);
  let executed = false;
  let timerRan = false;
  const timer = setTimeout(() => {
    timerRan = true;
  }, 0);
  t.after(() => clearTimeout(timer));
  const start = performance.now();
  failure(
    await store.transact(
      async (scope) => {
        await scope.run(
          "INSERT INTO fixture_notes VALUES('n','payload',0,x'00',NULL)",
        );
        executed = true;
        await scope.all(
          'WITH RECURSIVE x(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM x WHERE n<10000000) SELECT sum(n) FROM x',
        );
        return { ok: true, value: undefined };
      },
      limits(undefined, 1000),
    ),
    'deadline',
  );
  assert.ok(performance.now() - start >= 1000);
  assert.equal(executed, true);
  assert.equal(timerRan, true);
  assert.deepEqual(
    value(await store.readSnapshot(async (scope) => counts(scope), limits())),
    [0, 0, 0],
  );
});

test('fresh install, upgrade, replay, exact history and actual schema checks', async (t) => {
  const f = await fixture(t, release.slice(0, 1), false);
  assert.deepEqual(value(await f.store.checkSchema(limits())), {
    applied: 0,
    pending: 1,
  });
  let called = false;
  failure(
    await f.store.readSnapshot(async () => {
      called = true;
    }, limits()),
    'incompatible',
  );
  failure(
    await f.store.transact(async () => {
      called = true;
      return { ok: true, value: 0 };
    }, limits()),
    'incompatible',
  );
  assert.equal(called, false);
  value(await f.store.migrate(limits()));
  value(
    await f.store.transact(async (scope) => {
      await scope.run(
        "INSERT INTO fixture_notes VALUES('old','before',0,x'01')",
      );
      return { ok: true, value: 0 };
    }, limits()),
  );
  value(await f.store.close());
  const upgraded = await f.open(release);
  assert.deepEqual(value(await upgraded.checkSchema(limits())), {
    applied: 1,
    pending: 2,
  });
  value(await upgraded.migrate(limits()));
  value(await upgraded.migrate(limits()));
  assert.deepEqual(value(await upgraded.checkSchema(limits())), {
    applied: 3,
    pending: 0,
  });
  assert.deepEqual(
    value(
      await upgraded.readSnapshot(
        async (scope) => await scope.all('SELECT tag FROM fixture_notes'),
        limits(),
      ),
    ),
    [['migrated:before']],
  );
  for (const changed of [
    release.slice(0, 2),
    [...release].reverse(),
    [
      { ...release[0], sql: `${release[0].sql}\n-- changed` },
      ...release.slice(1),
    ],
  ]) {
    failure(
      await openState({ path: f.path, migrations: changed }, limits()),
      'incompatible',
    );
  }
  const raw = new DatabaseSync(f.path);
  try {
    raw.exec('CREATE TABLE drift(x)');
  } finally {
    raw.close();
  }
  failure(await upgraded.checkSchema(limits()), 'incompatible');
  failure(await upgraded.readSnapshot(async () => 0, limits()), 'incompatible');
});

test('failed migration rolls back DDL, data and journal; unknown/malformed history rejected', async (t) => {
  const f = await fixture(t, release.slice(0, 1));
  value(
    await f.store.transact(async (scope) => {
      await scope.run(
        "INSERT INTO fixture_notes VALUES('old','original',0,x'00')",
      );
      return { ok: true, value: 0 };
    }, limits()),
  );
  value(await f.store.close());
  const broken = [
    ...release.slice(0, 1),
    {
      id: 'bad',
      sql: "CREATE TABLE transient(x); UPDATE fixture_notes SET text='lost'; INSERT INTO absent VALUES(1);",
    },
  ];
  const upgrade = await f.open(broken);
  failure(await upgrade.migrate(limits()), 'operation_failed');
  value(await upgrade.close());
  const restored = await f.open(release.slice(0, 1));
  assert.deepEqual(value(await restored.checkSchema(limits())), {
    applied: 1,
    pending: 0,
  });
  assert.deepEqual(
    value(
      await restored.readSnapshot(
        async (scope) => await scope.all('SELECT text FROM fixture_notes'),
        limits(),
      ),
    ),
    [['original']],
  );
  const raw = new DatabaseSync(f.path);
  try {
    raw.exec("UPDATE _state_migrations SET position=5, digest='invalid'");
  } finally {
    raw.close();
  }
  failure(await restored.checkSchema(limits()), 'incompatible');
  const unknown = join(f.dir, 'unknown.db');
  const other = new DatabaseSync(unknown);
  other.exec('CREATE TABLE foreign_data(x)');
  other.close();
  chmodSync(unknown, 0o600);
  failure(
    await openState({ path: unknown, migrations: [] }, limits()),
    'incompatible',
  );
});

test('versions, effective WAL/FULL/FK, private files and safe unavailable/corrupt errors', async (t) => {
  const f = await fixture(t);
  const result = value(
    await f.store.readSnapshot(async (scope) => {
      for (const suffix of ['', '-wal', '-shm'])
        assert.equal(statSync(`${f.path}${suffix}`).mode & 0o777, 0o600);
      return await scope.all(
        'SELECT sqlite_version(),vec_version(),(SELECT journal_mode FROM pragma_journal_mode),(SELECT synchronous FROM pragma_synchronous),(SELECT foreign_keys FROM pragma_foreign_keys),(SELECT timeout FROM pragma_busy_timeout)',
      );
    }, limits()),
  );
  assert.deepEqual(result[0]?.slice(0, 5), ['3.53.4', 'v0.1.9', 'wal', 2, 1]);
  assert.ok(Number(result[0]?.[5]) > 40 && Number(result[0]?.[5]) <= 5000);
  assert.equal(statSync(f.dir).mode & 0o777, 0o700);
  const bad = join(f.dir, 'corrupt.db');
  writeFileSync(bad, 'not a database', { mode: 0o600 });
  failure(await openState({ path: bad, migrations: [] }, limits()), 'corrupt');
  failure(
    await openState(
      { path: join(f.dir, 'absent', 'data.db'), migrations: [] },
      limits(),
    ),
    'unavailable',
  );
  const link = join(f.dir, 'link.db');
  symlinkSync(f.path, link);
  failure(
    await openState({ path: link, migrations: release }, limits()),
    'unavailable',
  );
  chmodSync(bad, 0o644);
  failure(
    await openState({ path: bad, migrations: [] }, limits()),
    'unavailable',
  );
  chmodSync(f.dir, 0o755);
  failure(
    await openState({ path: f.path, migrations: release }, limits()),
    'unavailable',
  );
  chmodSync(f.dir, 0o700);
});

test('online SQLite backup is no-overwrite, private, independently restorable and cancellation-safe', async (t) => {
  const f = await fixture(t);
  value(
    await f.store.transact(async (scope) => {
      await writeOwners(scope);
      return { ok: true, value: 0 };
    }, limits()),
  );
  const source = readFileSync(f.path);
  const target = join(f.dir, 'backup.db');
  value(await f.store.adapter.backupTo(target, limits()));
  assert.equal(statSync(target).mode & 0o777, 0o600);
  const completed = readFileSync(target);
  failure(await f.store.adapter.backupTo(target, limits()), 'incompatible');
  assert.deepEqual(readFileSync(target), completed);
  failure(
    await f.store.adapter.backupTo(
      join(f.dir, 'cancelled.db'),
      limits(AbortSignal.abort()),
    ),
    'cancelled',
  );
  assert.equal(existsSync(join(f.dir, 'cancelled.db')), false);
  const restore = join(f.dir, 'restored.db');
  copyFileSync(target, restore);
  const restored = value(
    await openState({ path: restore, migrations: release }, limits()),
  );
  try {
    assert.deepEqual(
      value(
        await restored.readSnapshot(async (scope) => counts(scope), limits()),
      ),
      [1, 1, 1],
    );
    value(
      await restored.transact(async (scope) => {
        await writeOwners(scope, 'restored', 2n);
        return { ok: true, value: 0 };
      }, limits()),
    );
  } finally {
    value(await restored.close());
  }
  assert.deepEqual(readFileSync(f.path), source);
  assert.deepEqual(
    value(await f.store.readSnapshot(async (scope) => counts(scope), limits())),
    [1, 1, 1],
  );
  assert.equal(
    readdirSync(f.dir).some((name) => name.startsWith('.state-backup-')),
    false,
  );
});

test('cancellation while starting backup never publishes a target', async (t) => {
  const f = await fixture(t);
  value(
    await f.store.transact(async (scope) => {
      await scope.run(
        "INSERT INTO fixture_notes VALUES('large','fixture',0,zeroblob(10000000),NULL)",
      );
      return { ok: true, value: undefined };
    }, limits()),
  );
  const controller = new AbortController();
  const target = join(f.dir, 'cancelled-backup.db');
  const pending = f.store.adapter.backupTo(target, limits(controller.signal));
  controller.abort();
  failure(await pending, 'cancelled');
  assert.equal(existsSync(target), false);
  assert.equal(
    readdirSync(f.dir).some((name) => name.startsWith('.state-backup-')),
    false,
  );
  assert.deepEqual(
    value(
      await f.store.readSnapshot(
        async (scope) =>
          await scope.all('SELECT length(bytes) FROM fixture_notes'),
        limits(),
      ),
    ),
    [[10_000_000]],
  );
});

test('loss of the opened database path fails closed without silently recreating it', async (t) => {
  const f = await fixture(t);
  renameSync(f.path, join(f.dir, 'displaced.db'));
  let called = false;
  failure(
    await f.store.transact(async () => {
      called = true;
      return { ok: true, value: 0 };
    }, limits()),
    'unavailable',
  );
  assert.equal(called, false);
  assert.equal(existsSync(f.path), false);
  failure(await f.store.readSnapshot(async () => 0, limits()), 'closed');
});
