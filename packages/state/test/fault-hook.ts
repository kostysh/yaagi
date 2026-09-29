import fs from 'node:fs';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import {
  BroadcastChannel,
  getEnvironmentData,
  isMainThread,
  workerData,
} from 'node:worker_threads';

const mode = process.env.YAAGI_STATE_TEST_FAULT;
if (!isMainThread && mode === 'wal-cleanup' && workerData.job === 'check') {
  const control = getEnvironmentData('state-wal-cleanup') as {
    name: string;
    buffer: SharedArrayBuffer;
  };
  const original = fs.lstatSync;
  let paused = false;
  Object.defineProperty(fs, 'lstatSync', {
    value: (path: fs.PathLike, options?: fs.StatOptions) => {
      const stat = original(path, options);
      if (!paused && String(path).endsWith('-wal') && stat) {
        paused = true;
        const channel = new BroadcastChannel(control.name);
        try {
          channel.postMessage('observed-wal');
          // Only pause after a real metadata read. The real last reader closes
          // and SQLite itself removes WAL; no file or result is fabricated.
          if (
            Atomics.wait(new Int32Array(control.buffer), 0, 0, 5000) ===
            'timed-out'
          )
            throw new Error('WAL cleanup test barrier timed out');
        } finally {
          channel.close();
        }
      }
      return stat;
    },
  });
  syncBuiltinESMExports();
}
if (!isMainThread && mode === 'backup-cancel' && workerData.job === 'backup') {
  const fixture = new URL('./backup-fixture.js', import.meta.url).href;
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'node:sqlite' && context.parentURL !== fixture)
        return { url: fixture, shortCircuit: true };
      return next(specifier, context);
    },
  });
}
if (mode === 'extension') {
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'sqlite-vec-linux-x64/vec0.so')
        throw new Error('SECRET supply path');
      return next(specifier, context);
    },
  });
} else if (mode === 'full' || mode === 'readonly') {
  const prepare = DatabaseSync.prototype.prepare;
  // --import is inherited by workers. Only test processes use this preload;
  // failures are real SQLite failures, not fabricated adapter Result values.
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
}
if (
  !isMainThread &&
  workerData.job === 'transaction' &&
  (mode === 'worker-before' || mode === 'worker-after')
) {
  const exec = DatabaseSync.prototype.exec;
  DatabaseSync.prototype.exec = function (sql) {
    if (sql === 'COMMIT' && mode === 'worker-before') process.exit(71);
    const result = exec.call(this, sql);
    if (sql === 'COMMIT' && mode === 'worker-after') process.exit(72);
    return result;
  };
}
