import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import type { Result } from '@polyphony/core-types';
import { z } from 'zod';
import type { StorageFailure } from './contracts.js';
import { first, ProbeError, safeFailure } from './probe.js';

// Bounded migration experiment, not a reusable migration framework.
export type Migration = { readonly id: string; readonly sql: string };
export const release: readonly Migration[] = [
  '0000_initial',
  '0001_tag',
  '0002_vectors_and_transform',
].map((id) => ({
  id,
  sql: readFileSync(
    new URL(`../migrations/${id}.sql`, import.meta.url),
    'utf8',
  ),
}));

const Journal = z.array(
  z.object({
    position: z.number().int().nonnegative(),
    id: z.string(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    schema: z.string().regex(/^[a-f0-9]{64}$/),
  }),
);
const digest = (text: string) =>
  createHash('sha256').update(text).digest('hex');
function schemaHash(db: DatabaseSync): string {
  return digest(
    JSON.stringify(
      db
        .prepare(
          "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name != '_state_migrations' ORDER BY type,name",
        )
        .all(),
    ),
  );
}

function inspect(db: DatabaseSync, chain: readonly Migration[]) {
  if (
    new Set(chain.map((m) => m.id)).size !== chain.length ||
    chain.some((m) => !m.id || !m.sql)
  )
    throw new ProbeError('incompatible');
  const exists =
    first(
      db,
      "SELECT count(*) FROM sqlite_schema WHERE name='_state_migrations'",
    ) === 1;
  if (!exists) {
    if (
      first(
        db,
        "SELECT count(*) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
      ) !== 0
    )
      throw new ProbeError('incompatible');
    return { applied: 0, pending: chain.length };
  }
  const parsed = Journal.safeParse(
    db
      .prepare(
        'SELECT position,id,digest,schema FROM _state_migrations ORDER BY position',
      )
      .all(),
  );
  if (!parsed.success || parsed.data.length > chain.length)
    throw new ProbeError('incompatible');
  for (const [i, row] of parsed.data.entries()) {
    const expected = chain[i];
    if (
      !expected ||
      row.position !== i ||
      row.id !== expected.id ||
      row.digest !== digest(expected.sql)
    )
      throw new ProbeError('incompatible');
  }
  const last = parsed.data.at(-1);
  if (
    !last &&
    first(
      db,
      "SELECT count(*) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name != '_state_migrations'",
    ) !== 0
  )
    throw new ProbeError('incompatible');
  if (last && last.schema !== schemaHash(db))
    throw new ProbeError('incompatible');
  return {
    applied: parsed.data.length,
    pending: chain.length - parsed.data.length,
  };
}

export function checkSchema(
  db: DatabaseSync,
  chain: readonly Migration[],
): Result<{ applied: number; pending: number }, StorageFailure> {
  try {
    return { ok: true, value: inspect(db, chain) };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

export function migrate(
  db: DatabaseSync,
  chain: readonly Migration[],
): Result<void, StorageFailure> {
  try {
    db.exec('BEGIN IMMEDIATE');
    const { applied } = inspect(db, chain);
    db.exec(
      'CREATE TABLE IF NOT EXISTS _state_migrations(position INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, digest TEXT NOT NULL, schema TEXT NOT NULL)',
    );
    for (let i = applied; i < chain.length; i++) {
      const migration = chain[i];
      if (!migration) throw new ProbeError('incompatible');
      // Trusted release SQL owns schema/data changes, never transaction control.
      if (
        /\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|ATTACH|DETACH|VACUUM|PRAGMA)\b/i.test(
          migration.sql,
        )
      )
        throw new ProbeError('incompatible');
      db.exec(migration.sql);
      if (!db.isTransaction) throw new ProbeError('sql_failed');
      db.prepare('INSERT INTO _state_migrations VALUES(?,?,?,?)').run(
        i,
        migration.id,
        digest(migration.sql),
        schemaHash(db),
      );
    }
    db.exec('COMMIT');
    return { ok: true, value: undefined };
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    return { ok: false, error: safeFailure(error) };
  }
}
