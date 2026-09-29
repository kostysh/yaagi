import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import { ownerDb } from './bridge.js';
import { counts, fixture, value, vector, writeOwners } from './fixture.js';
import { checkSchema, migrate, release } from './migrations.js';
import { Note, notes } from './owners/alpha.js';
import { marks } from './owners/beta.js';
import { first, ProbeError, ProbeStore, scalar } from './probe.js';
import type { SqlScope } from './sqlite.js';

test('S1: callbacks preserve falsy/undefined payload and opaque owner errors', async (t) => {
  const f = fixture(t);
  for (const payload of [undefined, null, false, 0, ''] as const) {
    assert.deepEqual(
      await f.store.transact(async () => ({ ok: true, value: payload })),
      { ok: true, value: payload },
    );
    assert.deepEqual(
      await f.store.transact(async () => ({ ok: false, error: payload })),
      { ok: false, error: { kind: 'owner', error: payload } },
    );
  }
});

test('S1: Drizzle + two owners + vector/BLOB share commit, snapshot DTO and reopen', async (t) => {
  const f = fixture(t);
  value(
    await f.store.transact(async (scope) => {
      await writeOwners(scope);
      return { ok: true, value: undefined };
    }),
  );
  f.store.close();
  const reopened = f.open();
  assert.deepEqual(counts(reopened), [1, 1, 1]);
  const result = await new ProbeStore(reopened).readSnapshot(async (scope) => {
    const db = ownerDb(scope);
    const row = await db.select().from(notes).where(eq(notes.id, 'n')).get();
    assert.equal(
      await db.select().from(notes).where(eq(notes.id, 'missing')).get(),
      undefined,
    );
    assert.equal((await db.select().from(marks).all())[0]?.amount, 0);
    assert.deepEqual(
      scope.all(
        'SELECT rowid,distance FROM fixture_vectors WHERE embedding MATCH ? AND k=?',
        [vector, 1n],
      ),
      [[1, 0]],
    );
    assert.equal(
      scalar(scope.all('SELECT ?', [9223372036854775807n])),
      9223372036854775807n,
    );
    return Note.parse(row);
  });
  assert.deepEqual(
    new Uint8Array(value(result).bytes),
    new Uint8Array([0, 255, 128, 42]),
  );
  assert.equal(reopened.isTransaction, false);
});

test('S1: await holds transaction; outsider busy, owner has no nested API; expired handle rejects', async (t) => {
  const f = fixture(t);
  const entered = Promise.withResolvers<void>();
  const releaseCallback = Promise.withResolvers<void>();
  let saved: SqlScope | undefined;
  const pending = f.store.transact(async (scope) => {
    saved = scope;
    await writeOwners(scope);
    assert.equal('transaction' in ownerDb(scope), false);
    assert.equal('$client' in ownerDb(scope), false);
    entered.resolve();
    await releaseCallback.promise;
    return { ok: true as const, value: 0 };
  });
  try {
    await entered.promise;
    assert.equal(f.db.isTransaction, true);
    assert.deepEqual(counts(f.open()), [0, 0, 0]);
    assert.deepEqual(await f.store.readSnapshot(async () => 'outsider'), {
      ok: false,
      error: { kind: 'storage', code: 'busy' },
    });
  } finally {
    releaseCallback.resolve();
  }
  assert.equal(value(await pending), 0);
  assert.throws(() => saved?.all('SELECT 1'), new ProbeError('scope_ended'));
  assert.equal(f.db.isTransaction, false);
});

for (const failure of [
  'throw',
  'owner',
  'constraint',
  'auto-rollback',
  'owner-commit',
] as const) {
  test(`S1: ${failure} rolls back every owner and vector; caught SQL stays poisoned`, async (t) => {
    const f = fixture(t);
    let calls = 0;
    const result = await f.store.transact(async (scope) => {
      calls++;
      await writeOwners(scope);
      if (failure === 'throw')
        throw new Error('private SQL/payload must not leak');
      if (failure === 'owner')
        return { ok: false as const, error: { code: 'conflict' } };
      const sql =
        failure === 'owner-commit'
          ? 'COMMIT'
          : `INSERT ${failure === 'auto-rollback' ? 'OR ROLLBACK' : ''} INTO fixture_notes(id,text,revision,bytes) SELECT id,text,revision,bytes FROM fixture_notes`;
      assert.throws(() => scope.run(sql), new ProbeError('sql_failed'));
      if (failure === 'auto-rollback') assert.equal(f.db.isTransaction, false);
      assert.throws(
        () => scope.run('UPDATE fixture_notes SET revision=99'),
        new ProbeError('sql_failed'),
      );
      return { ok: true as const, value: 1 };
    });
    assert.equal(calls, 1);
    const error =
      failure === 'owner'
        ? { kind: 'owner', error: { code: 'conflict' } }
        : {
            kind: 'storage',
            code: failure === 'throw' ? 'callback_failed' : 'sql_failed',
          };
    assert.deepEqual(result, { ok: false, error });
    f.store.close();
    assert.deepEqual(counts(f.open()), [0, 0, 0]);
  });
}

test('S1: owner-local stale revision rolls back earlier owner writes', async (t) => {
  const f = fixture(t);
  value(
    await f.store.transact(async (scope) => {
      await writeOwners(scope);
      return { ok: true, value: null };
    }),
  );
  const result = await f.store.transact(async (scope) => {
    await ownerDb(scope).update(marks).set({ amount: 9 });
    if (
      scalar(
        scope.all('SELECT revision FROM fixture_notes WHERE id=?', ['n']),
      ) !== 10
    )
      return { ok: false, error: 'conflict' };
    return { ok: true, value: undefined };
  });
  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'owner', error: 'conflict' },
  });
  assert.equal(first(f.db, 'SELECT amount FROM fixture_marks'), 0);
});

test('S1: real concurrent writer cannot mix a snapshot; read scope rejects writes', async (t) => {
  const f = fixture(t);
  value(
    await f.store.transact(async (scope) => {
      await writeOwners(scope);
      return { ok: true, value: false };
    }),
  );
  const writer = new ProbeStore(f.open());
  const snapshot = await f.store.readSnapshot(async (scope) => {
    const before = scalar(scope.all('SELECT revision FROM fixture_notes'));
    value(
      await writer.transact(async (other) => {
        other.run('UPDATE fixture_notes SET revision=1');
        other.run('UPDATE fixture_marks SET amount=1');
        return { ok: true, value: undefined };
      }),
    );
    return [before, scalar(scope.all('SELECT amount FROM fixture_marks'))];
  });
  assert.deepEqual(value(snapshot), [0, 0]);
  assert.equal(first(f.db, 'SELECT revision FROM fixture_notes'), 1);
  const write = await f.store.readSnapshot(async (scope) =>
    scope.all('UPDATE fixture_notes SET revision=9 RETURNING revision'),
  );
  assert.deepEqual(write, {
    ok: false,
    error: { kind: 'storage', code: 'write_failed' },
  });
  assert.equal(first(f.open(), 'SELECT revision FROM fixture_notes'), 1);
});

test('S1: generated + custom migration fresh/upgrade/repeat/reopen and existing data', (t) => {
  const f = fixture(t, false);
  value(migrate(f.db, release.slice(0, 1)));
  f.db
    .prepare('INSERT INTO fixture_notes VALUES(?,?,?,?)')
    .run('old', 'history', 0, new Uint8Array([9]));
  assert.deepEqual(value(checkSchema(f.db, release)), {
    applied: 1,
    pending: 2,
  });
  value(migrate(f.db, release));
  assert.equal(
    first(f.db, 'SELECT tag FROM fixture_notes'),
    'migrated:history',
  );
  value(migrate(f.db, release));
  f.db.close();
  assert.deepEqual(value(checkSchema(f.open(), release)), {
    applied: 3,
    pending: 0,
  });
});

test('S1: changed/reordered/truncated history, malformed journal and schema drift reject', (t) => {
  const f = fixture(t);
  const changed = release.map((m, i) =>
    i === 0 ? { ...m, sql: `${m.sql}\n-- changed` } : m,
  );
  for (const chain of [changed, [...release].reverse(), release.slice(0, 1)]) {
    assert.deepEqual(checkSchema(f.db, chain), {
      ok: false,
      error: { kind: 'storage', code: 'incompatible' },
    });
    assert.equal(migrate(f.db, chain).ok, false);
  }
  f.db.exec('ALTER TABLE fixture_notes ADD COLUMN unexpected TEXT');
  assert.equal(checkSchema(f.db, release).ok, false);
  f.db.exec("UPDATE _state_migrations SET digest='invalid'");
  assert.equal(checkSchema(f.db, release).ok, false);
});

test('S1: failed migration restores schema, original data and journal as one unit', (t) => {
  const f = fixture(t, false);
  value(migrate(f.db, release.slice(0, 1)));
  f.db.exec("INSERT INTO fixture_notes VALUES('old','history',0,X'01')");
  const failed = migrate(f.db, [
    ...release,
    {
      id: '0003_fail',
      sql: "UPDATE fixture_notes SET text='lost'; INSERT INTO missing_table VALUES(1);",
    },
  ]);
  assert.equal(failed.ok, false);
  f.db.close();
  const db = f.open();
  assert.equal(first(db, 'SELECT text FROM fixture_notes'), 'history');
  assert.equal(first(db, 'SELECT count(*) FROM _state_migrations'), 1);
  assert.equal(
    first(
      db,
      "SELECT count(*) FROM sqlite_schema WHERE name='fixture_vectors'",
    ),
    0,
  );
  value(migrate(db, release));
});

test('S1: vec0 integer binding regression, non-finite and int64 overflow fail safely', async (t) => {
  const f = fixture(t);
  for (const param of [1, Infinity, 9223372036854775808n]) {
    const result = await f.store.transact(async (scope) => {
      scope.run('INSERT INTO fixture_vectors(rowid,embedding) VALUES(?,?)', [
        param,
        vector,
      ]);
      return { ok: true, value: undefined };
    });
    assert.deepEqual(result, {
      ok: false,
      error: { kind: 'storage', code: 'sql_failed' },
    });
  }
  assert.equal(counts(f.db)[2], 0);
});
