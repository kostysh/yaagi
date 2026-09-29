import assert from 'node:assert/strict';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { promises as fs } from 'node:fs';

let portable = true;
registerHooks({
  resolve(specifier, context, next) {
    if (
      (portable &&
        (specifier.startsWith('node:') ||
          specifier === 'agenda' ||
          specifier.startsWith('drizzle-orm'))) ||
      specifier === 'node:sqlite' ||
      specifier === 'node:worker_threads' ||
      specifier.includes('sqlite-vec')
    )
      throw new Error('Unexpected resource/backend import');
    return next(specifier, context);
  },
});
const timer = globalThis.setTimeout;
const interval = globalThis.setInterval;
globalThis.setTimeout = (() => {
  throw new Error('Timer during import');
}) as unknown as typeof timer;
globalThis.setInterval = (() => {
  throw new Error('Polling during import');
}) as typeof interval;
const readFile = fs.readFile;
fs.readFile = ((...args: Parameters<typeof fs.readFile>) => {
  if (String(args[0]).endsWith('.sql'))
    throw new Error('Migration read during import');
  return readFile(...args);
}) as typeof readFile;
syncBuiltinESMExports();
try {
  assert.deepEqual(Object.keys(await import('@polyphony/queue/contracts')), []);
  assert.deepEqual(Object.keys(await import('@polyphony/queue/ports')), []);
  assert.deepEqual(Object.keys(await import('@polyphony/queue')), [
    'createQueue',
    'defineJob',
  ]);
  portable = false;
  assert.deepEqual(
    Object.keys(await import('@polyphony/queue/adapters/agenda')),
    ['createAgendaAdapter'],
  );
  assert.deepEqual(
    Object.keys(await import('@polyphony/queue/storage/sqlite')),
    ['bindQueueScope', 'loadQueueMigrations'],
  );
  for (const path of [
    '@polyphony/queue/internal/store',
    '@polyphony/queue/src/index.js',
  ])
    await assert.rejects(import(path), {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
} finally {
  globalThis.setTimeout = timer;
  globalThis.setInterval = interval;
  fs.readFile = readFile;
  syncBuiltinESMExports();
}
