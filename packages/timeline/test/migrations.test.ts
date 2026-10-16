import assert from 'node:assert/strict';
import test from 'node:test';
import { createSqliteAdapter } from '@polyphony/state/adapters/sqlite';
import { fixture, limits, reserve, value } from './fixture.js';

test('real release migration: fresh, failed chain rollback, repeat, and compatible reopen preserve data', async (t) => {
  const { state, open, migrations, path } = await fixture(t, false);
  assert.deepEqual(value(await state.checkSchema(limits())), {
    applied: 0,
    pending: 1,
  });
  const failing = await open([
    ...migrations,
    {
      id: 'timeline_test_failure',
      sql: 'CREATE TABLE timeline_test_probe(x); INSERT INTO timeline_missing VALUES (1);',
    },
  ]);
  const failed = await failing.migrate(limits());
  assert.equal(failed.ok, false);
  value(await failing.close());
  assert.deepEqual(value(await state.checkSchema(limits())), {
    applied: 0,
    pending: 1,
  });
  const inspection = await open([]);
  assert.deepEqual(
    value(
      await inspection.readSnapshot(
        (o) =>
          o.sql.all(
            "SELECT name FROM sqlite_master WHERE name LIKE 'timeline_%'",
          ),
        limits(),
      ),
    ),
    [],
  );
  value(await inspection.close());
  value(await state.migrate(limits()));
  value(await state.migrate(limits()));
  assert.deepEqual(value(await state.checkSchema(limits())), {
    applied: 1,
    pending: 0,
  });
  value(
    await state.transact((o) => o.timeline.reserveTick(reserve()), limits()),
  );
  const saved = value(
    await state.transact((o) => o.timeline.resume(), limits()),
  );
  value(await state.close());
  const reopened = await open();
  value(await reopened.migrate(limits()));
  assert.deepEqual(
    value(
      value(
        await reopened.readSnapshot((o) => o.timeline.readHead(), limits()),
      ),
    ),
    saved,
  );
  // A mismatched release chain refuses boot without modifying the stored history.
  const changed = await createSqliteAdapter(
    {
      path,
      migrations: [
        {
          ...migrations[0],
          sql: `${migrations[0].sql}\n-- changed applied artifact`,
        },
      ],
    },
    limits(),
  );
  assert.deepEqual(changed, {
    ok: false,
    error: { kind: 'storage', code: 'incompatible' },
  });
  assert.deepEqual(
    value(
      value(
        await reopened.readSnapshot((o) => o.timeline.readHead(), limits()),
      ),
    ),
    saved,
  );
});
