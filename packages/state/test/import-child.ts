import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

let contractsOnly = true;
registerHooks({
  resolve(specifier, context, next) {
    if (
      (contractsOnly && specifier.startsWith('node:')) ||
      specifier === 'node:sqlite' ||
      specifier.includes('sqlite-vec') ||
      specifier.includes('drizzle-orm')
    )
      throw new Error('Unexpected native dependency');
    return next(specifier, context);
  },
});
assert.deepEqual(Object.keys(await import('@polyphony/state/contracts')), []);
assert.deepEqual(Object.keys(await import('@polyphony/state/sqlite')), []);
contractsOnly = false;
assert.deepEqual(Object.keys(await import('@polyphony/state/node')), [
  'openSqlite',
]);
