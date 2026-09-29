import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { SchemaStatus } from '../contracts.js';
import type { SqlMigration } from '../sqlite.js';
import type { Budget } from './budget.js';
import { StorageError } from './errors.js';

const journalSql =
  'CREATE TABLE _state_migrations(position INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, digest TEXT NOT NULL, schema TEXT NOT NULL)';
const Journal = z.array(
  z.object({
    position: z.number().int().nonnegative(),
    id: z.string().min(1),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    schema: z.string().regex(/^[a-f0-9]{64}$/),
  }),
);
const digest = (text: string): string =>
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

export function inspect(
  db: DatabaseSync,
  chain: readonly SqlMigration[],
  budget: Budget,
): SchemaStatus {
  budget.check();
  const journal = db
    .prepare("SELECT sql FROM sqlite_schema WHERE name='_state_migrations'")
    .get();
  if (!journal) {
    if (
      db
        .prepare(
          "SELECT name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
        )
        .get()
    )
      throw new StorageError('incompatible');
    budget.check();
    return { applied: 0, pending: chain.length };
  }
  if (journal.sql !== journalSql) throw new StorageError('incompatible');
  const parsed = Journal.safeParse(
    db
      .prepare(
        'SELECT position,id,digest,schema FROM _state_migrations ORDER BY position',
      )
      .all(),
  );
  if (!parsed.success || parsed.data.length > chain.length)
    throw new StorageError('incompatible');
  for (const [i, row] of parsed.data.entries()) {
    const expected = chain[i];
    if (
      !expected ||
      row.position !== i ||
      row.id !== expected.id ||
      row.digest !== digest(expected.sql)
    )
      throw new StorageError('incompatible');
  }
  const last = parsed.data.at(-1);
  if (
    !last &&
    db
      .prepare(
        "SELECT name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name != '_state_migrations'",
      )
      .get()
  )
    throw new StorageError('incompatible');
  if (last && last.schema !== schemaHash(db))
    throw new StorageError('incompatible');
  budget.check();
  return {
    applied: parsed.data.length,
    pending: chain.length - parsed.data.length,
  };
}

// Called only inside the connection's exclusive BEGIN IMMEDIATE scope.
export function applyMigrations(
  db: DatabaseSync,
  chain: readonly SqlMigration[],
  budget: Budget,
): void {
  const { applied } = inspect(db, chain, budget);
  if (
    !db
      .prepare("SELECT name FROM sqlite_schema WHERE name='_state_migrations'")
      .get()
  )
    db.exec(journalSql);
  for (let i = applied; i < chain.length; i++) {
    budget.check();
    const migration = chain[i];
    // Conservative guard for trusted release artifacts, not a SQL sandbox/parser.
    if (
      !migration ||
      /\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|ATTACH|DETACH|VACUUM|PRAGMA)\b/i.test(
        migration.sql,
      )
    )
      throw new StorageError('incompatible');
    db.exec(migration.sql);
    if (!db.isTransaction) throw new StorageError('sql_failed');
    budget.check();
    db.prepare('INSERT INTO _state_migrations VALUES(?,?,?,?)').run(
      i,
      migration.id,
      digest(migration.sql),
      schemaHash(db),
    );
  }
  budget.check();
}
