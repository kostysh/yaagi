import { createHash } from 'node:crypto';
import { constants, type DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { SchemaStatus } from '../../contracts.js';
import type { SqlMigration } from '../sqlite.js';
import type { Budget } from '../../internal/budget.js';
import { StorageError } from '../../internal/errors.js';

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
          "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name != '_state_migrations' ORDER BY type,name",
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
          "SELECT name FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'",
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
        "SELECT name FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name != '_state_migrations'",
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

const connectionActions = new Set<number>([
  constants.SQLITE_TRANSACTION,
  constants.SQLITE_SAVEPOINT,
  constants.SQLITE_ATTACH,
  constants.SQLITE_DETACH,
  constants.SQLITE_PRAGMA,
]);

function executeArtifact(db: DatabaseSync, sql: string): void {
  let rejected = false;
  // SQLite identifies operations, including END-as-COMMIT, without confusing
  // data literals, comments or trigger/CASE syntax with connection control.
  db.setAuthorizer((action) => {
    if (connectionActions.has(action)) {
      rejected = true;
      return constants.SQLITE_DENY;
    }
    return constants.SQLITE_OK;
  });
  try {
    db.exec(sql);
  } catch (error) {
    if (rejected) throw new StorageError('incompatible');
    throw error;
  } finally {
    db.setAuthorizer(null);
  }
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
    if (!migration) throw new StorageError('incompatible');
    executeArtifact(db, migration.sql);
    if (!db.isTransaction) throw new StorageError('operation_failed');
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
