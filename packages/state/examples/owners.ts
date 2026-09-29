import type { SqlScope, SqlValue } from '@polyphony/state/adapters/sqlite';
import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { z } from 'zod';

// These tables, DTO and ORM adapter belong to consumers, not state.
export const notes = sqliteTable('fixture_notes', {
  id: text().primaryKey(),
  text: text().notNull(),
  revision: integer().notNull(),
  bytes: blob({ mode: 'buffer' }).notNull(),
  tag: text(),
});
export const marks = sqliteTable('fixture_marks', {
  id: text().primaryKey(),
  noteId: text()
    .notNull()
    .references(() => notes.id),
  amount: integer().notNull(),
});
export const Note = z.object({
  id: z.string().min(1),
  text: z.string(),
  revision: z.number().int().nonnegative(),
  bytes: z.instanceof(Uint8Array).transform((bytes) => new Uint8Array(bytes)),
});

function parameter(value: unknown): SqlValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value instanceof Uint8Array
  )
    return value;
  throw new TypeError('Unsupported SQL parameter');
}
export function ownerDb(scope: SqlScope) {
  const db = drizzle(async (sql, params: unknown[], method) => {
    const values = params.map(parameter);
    if (method === 'run') {
      await scope.run(sql, values);
      return { rows: [] };
    }
    const rows = await scope.all(sql, values);
    // Drizzle 0.45.3 get consumes a single positional row or undefined;
    // its callback type incorrectly requires any[] also for a missing row.
    return { rows: method === 'get' ? (rows[0] as SqlValue[]) : rows };
  });
  return {
    select: db.select.bind(db),
    insert: db.insert.bind(db),
    update: db.update.bind(db),
    delete: db.delete.bind(db),
  };
}

export const vector = new Uint8Array(new Float32Array([1, 2, 3]).buffer);
export async function writeOwners(
  scope: SqlScope,
  id = 'n',
  rowid = 1n,
): Promise<void> {
  const note = Note.parse({
    id,
    text: 'fixture',
    revision: 0,
    bytes: new Uint8Array([0, 255, 128, 42]),
  });
  const db = ownerDb(scope);
  await db.insert(notes).values({ ...note, bytes: Buffer.from(note.bytes) });
  await db.insert(marks).values({ id: `m-${id}`, noteId: id, amount: 0 });
  await scope.run('INSERT INTO fixture_vectors(rowid,embedding) VALUES(?,?)', [
    rowid,
    vector,
  ]);
}
