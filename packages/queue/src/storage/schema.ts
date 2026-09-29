import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const jobs = sqliteTable(
  'queue_jobs',
  {
    namespace: text().notNull(),
    id: text().notNull(),
    name: text().notNull(),
    version: integer().notNull(),
    status: text().notNull(),
    notBefore: integer('not_before').notNull(),
    lockedAt: integer('locked_at'),
    body: text().notNull(),
  },
  (row) => [
    primaryKey({ columns: [row.namespace, row.id] }),
    index('queue_due').on(
      row.namespace,
      row.name,
      row.version,
      row.status,
      row.notBefore,
    ),
  ],
);
