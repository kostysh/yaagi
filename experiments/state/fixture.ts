import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { Result } from '@polyphony/core-types';
import { ownerDb } from './bridge.js';
import { migrate, release } from './migrations.js';
import { Note, notes } from './owners/alpha.js';
import { marks } from './owners/beta.js';
import { openProbeDb, ProbeStore } from './probe.js';
import type { SqlScope } from './sqlite.js';

export function value<T, E>(result: Result<T, E>): T {
  assert.equal(
    result.ok,
    true,
    JSON.stringify(result, (_, v: unknown) =>
      typeof v === 'bigint' ? String(v) : v,
    ),
  );
  if (!result.ok) throw new Error('Expected success');
  return result.value;
}

export function fixture(t: TestContext, migration = true) {
  const dir = mkdtempSync(join(tmpdir(), 'yaagi-state-'));
  const path = join(dir, 'state.db');
  const connections: DatabaseSync[] = [];
  const open = () => {
    const db = openProbeDb(path);
    connections.push(db);
    return db;
  };
  t.after(() => {
    for (const db of connections) if (db.isOpen) db.close();
    rmSync(dir, { recursive: true });
  });
  const db = open();
  if (migration) value(migrate(db, release));
  return { dir, path, db, open, store: new ProbeStore(db) };
}

export const vector = new Uint8Array(new Float32Array([1, 2, 3]).buffer);
export async function writeOwners(scope: SqlScope, id = 'n', rowid = 1n) {
  const input = Note.parse({
    id,
    text: 'fixture',
    revision: 0,
    bytes: new Uint8Array([0, 255, 128, 42]),
  });
  const db = ownerDb(scope);
  await db.insert(notes).values({ ...input, bytes: Buffer.from(input.bytes) });
  await db.insert(marks).values({ id: `m-${id}`, noteId: id, amount: 0 });
  // node:sqlite binds number as REAL. vec0 integer IDs/limits require bigint.
  scope.run('INSERT INTO fixture_vectors(rowid,embedding) VALUES(?,?)', [
    rowid,
    vector,
  ]);
}

export function counts(db: DatabaseSync): number[] {
  return ['fixture_notes', 'fixture_marks', 'fixture_vectors'].map((table) =>
    Number(
      Object.values(db.prepare(`SELECT count(*) FROM ${table}`).get() ?? {})[0],
    ),
  );
}
