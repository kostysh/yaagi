import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { openSqlite } from '@polyphony/state/node';
import { counts, failure, limits, release, value } from './fixture.js';

const [path, mode] = process.argv.slice(2);
if (mode === 'extension') {
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'sqlite-vec-linux-x64/vec0.so')
        throw new Error('SECRET supply path');
      return next(specifier, context);
    },
  });
  failure(
    await openSqlite({ path, migrations: release }, limits()),
    'incompatible',
  );
} else {
  const store = value(
    await openSqlite({ path, migrations: release }, limits()),
  );
  const prepare = DatabaseSync.prototype.prepare;
  // Test-local fault setup on the real connection; no production test API.
  DatabaseSync.prototype.prepare = function (sql) {
    if (sql.includes('zeroblob')) {
      if (mode === 'full') {
        const pages = Object.values(
          prepare.call(this, 'PRAGMA page_count').get() ?? {},
        )[0];
        this.exec(`PRAGMA max_page_count=${pages}`);
      } else this.exec('PRAGMA query_only=ON');
    }
    return prepare.call(this, sql);
  };
  try {
    failure(
      await store.transact(async (scope) => {
        scope.run(
          "INSERT INTO fixture_notes VALUES('bad','x',0,zeroblob(10000000),NULL)",
        );
        return { ok: true, value: undefined };
      }, limits()),
      mode === 'full' ? 'full' : 'write_failed',
    );
    if (mode === 'readonly')
      failure(await store.readSnapshot(async () => 0, limits()), 'closed');
  } finally {
    DatabaseSync.prototype.prepare = prepare;
    value(await store.close());
  }
  const reopened = value(
    await openSqlite({ path, migrations: release }, limits()),
  );
  assert.deepEqual(
    value(
      await reopened.readSnapshot(async (scope) => counts(scope), limits()),
    ),
    [0, 0, 0],
  );
  value(await reopened.close());
}
