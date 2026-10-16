import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { registerHooks } from 'node:module';

let contracts = true;
const hook = registerHooks({
  resolve(specifier, context, next) {
    assert.ok(
      !contracts ||
        (!specifier.startsWith('node:') &&
          !specifier.includes('sqlite') &&
          !specifier.includes('drizzle')),
      `contracts runtime leak: ${specifier}`,
    );
    assert.ok(
      !specifier.includes('@sqliteai') && specifier !== 'node:sqlite',
      'native import during package import',
    );
    return next(specifier, context);
  },
});
const before = readdirSync(process.cwd());
await import('@polyphony/timeline');
await import('@polyphony/timeline/contracts');
contracts = false;
const sqlite = await import('@polyphony/timeline/sqlite');
assert.deepEqual(Object.keys(sqlite).sort(), [
  'bindTimeline',
  'loadTimelineMigrations',
]);
assert.deepEqual(readdirSync(process.cwd()), before);
const migrations = await sqlite.loadTimelineMigrations();
assert.equal(migrations.length, 1);
assert.equal(migrations[0].id, 'timeline_0000');
assert.match(migrations[0].sql, /CREATE TABLE timeline_ticks/);
hook.deregister();
console.log('imports and built SQL independent of cwd: passed');
