import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Worker } from 'node:worker_threads';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { blob, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Reply, Request } from './concurrency-worker.js';

function connection(cleanups: (() => Promise<void>)[], path: string) {
  const cancellation = new SharedArrayBuffer(4);
  const worker = new Worker(
    new URL('./concurrency-worker.js', import.meta.url),
    {
      workerData: { path, cancellation },
    },
  );
  const exit = new Promise<void>((resolve, reject) => {
    worker.once('error', reject);
    worker.once('exit', (code) =>
      code ? reject(new Error(`exit ${code}`)) : resolve(),
    );
  });
  const pending = new Map<
    number,
    {
      start: () => void;
      resolve: (rows: unknown[][]) => void;
      reject: (error: Error) => void;
    }
  >();
  worker.on('message', (reply: Reply) => {
    const call = pending.get(reply.id);
    assert.ok(call);
    if (reply.phase === 'starting') call.start();
    else {
      pending.delete(reply.id);
      if (reply.error) call.reject(new Error(reply.error));
      else call.resolve(reply.rows);
    }
  });
  let id = 0;
  const send = (
    kind: Request['kind'],
    sql = '',
    params: Request['params'] = [],
  ) => {
    const key = ++id;
    const started = Promise.withResolvers<void>();
    const result = new Promise<unknown[][]>((resolve, reject) => {
      pending.set(key, { start: () => started.resolve(), resolve, reject });
      worker.postMessage({ id: key, kind, sql, params } satisfies Request);
    });
    return { started: started.promise, result };
  };
  cleanups.push(async () => {
    await send('close').result;
    await exit;
  });
  return { send, cancellation };
}

const notes = sqliteTable('probe_notes', {
  id: text().primaryKey(),
  bytes: blob({ mode: 'buffer' }).notNull(),
});
test('S1/S2 delta: native worker wait, independent reads, Drizzle/BLOB/vector, rollback and cancellation', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'yaagi-worker-probe-'));
  const cleanups: (() => Promise<void>)[] = [];
  t.after(async () => {
    for (const close of cleanups) await close();
    rmSync(dir, { recursive: true });
  });
  const path = join(dir, 'probe.db');
  const a = connection(cleanups, path);
  await a.send(
    'exec',
    'CREATE TABLE probe_notes(id TEXT PRIMARY KEY, bytes BLOB NOT NULL); CREATE VIRTUAL TABLE probe_vectors USING vec0(embedding float[3])',
  ).result;
  const b = connection(cleanups, path);
  const c = connection(cleanups, path);
  const bytes = new Uint8Array([0, 255, 42]);
  const vector = new Uint8Array(new Float32Array([1, 2, 3]).buffer);
  const orm = drizzle(async (sql, params: Request['params'], method) => {
    const rows = await a.send(method === 'run' ? 'run' : 'all', sql, params)
      .result;
    return { rows: method === 'get' ? (rows[0] as unknown[]) : rows };
  });
  await a.send('exec', 'BEGIN IMMEDIATE').result;
  await orm.insert(notes).values({ id: 'a', bytes: Buffer.from(bytes) });
  await a.send(
    'run',
    'INSERT INTO probe_vectors(rowid,embedding) VALUES(?,?)',
    [1n, vector],
  ).result;
  const waiting = b.send('exec', 'BEGIN IMMEDIATE');
  await waiting.started;
  // A stays in its transaction while B is inside synchronous BEGIN on another thread.
  assert.equal(
    (await a.send('all', 'SELECT count(*) FROM probe_notes').result)[0]?.[0],
    1,
  );
  await a.send('exec', 'COMMIT').result;
  await waiting.result;
  await b.send('run', 'INSERT INTO probe_notes VALUES(?,?)', ['b', bytes])
    .result;
  await b.send('exec', 'COMMIT').result;
  assert.deepEqual(
    await c.send('all', 'SELECT bytes FROM probe_notes ORDER BY id').result,
    [[bytes], [bytes]],
  );
  assert.equal(
    (
      await c.send(
        'all',
        'SELECT rowid FROM probe_vectors WHERE embedding MATCH ? AND k=?',
        [vector, 1n],
      ).result
    )[0]?.[0],
    1,
  );

  await Promise.all([
    a.send('exec', 'BEGIN').result,
    b.send('exec', 'BEGIN').result,
  ]);
  assert.deepEqual(
    await Promise.all([
      a.send('all', 'SELECT count(*) FROM probe_notes').result,
      b.send('all', 'SELECT count(*) FROM probe_notes').result,
    ]),
    [[[2]], [[2]]],
  );
  await c.send(
    'exec',
    "BEGIN IMMEDIATE; INSERT INTO probe_notes VALUES('c',x'01'); COMMIT",
  ).result;
  assert.deepEqual(
    await a.send('all', 'SELECT count(*) FROM probe_notes').result,
    [[2]],
  );
  await Promise.all([
    a.send('exec', 'ROLLBACK').result,
    b.send('exec', 'ROLLBACK').result,
  ]);

  await a.send(
    'exec',
    "BEGIN IMMEDIATE; INSERT INTO probe_notes VALUES('rollback',x'01')",
  ).result;
  const afterRollback = b.send('exec', 'BEGIN IMMEDIATE');
  await afterRollback.started;
  await a.send('exec', 'ROLLBACK').result;
  await afterRollback.result;
  await b.send(
    'exec',
    "INSERT INTO probe_notes VALUES('after-rollback',x'01'); COMMIT",
  ).result;

  await a.send('exec', 'BEGIN IMMEDIATE').result;
  await b.send('exec', 'PRAGMA busy_timeout=50').result;
  await assert.rejects(b.send('exec', 'BEGIN IMMEDIATE').result, /locked/);
  await a.send('exec', 'ROLLBACK').result;
  await b.send('exec', 'PRAGMA busy_timeout=3000').result;

  await a.send('exec', 'BEGIN IMMEDIATE').result;
  const longSql = a.send(
    'run',
    "INSERT INTO probe_notes SELECT 'cancelled',zeroblob(sum(n)%100) FROM (WITH RECURSIVE x(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM x WHERE n<2000000) SELECT n FROM x)",
  );
  await longSql.started;
  Atomics.store(new Int32Array(a.cancellation), 0, 1);
  await longSql.result;
  await assert.rejects(a.send('exec', 'COMMIT').result, /cancelled/);
  for (const close of cleanups) await close();
  cleanups.length = 0;
  const reopened = connection(cleanups, path);
  assert.deepEqual(
    await reopened.send('all', 'SELECT sqlite_version(),vec_version()').result,
    [['3.53.4', 'v0.1.9']],
  );
  assert.deepEqual(
    await reopened.send('all', 'SELECT id FROM probe_notes ORDER BY id').result,
    [['a'], ['after-rollback'], ['b'], ['c']],
  );
});
