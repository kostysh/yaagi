import { sql } from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const ticks = sqliteTable(
  'timeline_ticks',
  {
    tickId: text('tick_id').primaryKey(),
    agentId: text('agent_id').notNull(),
    sequence: integer().notNull(),
    phase: text().notNull(),
    body: text().notNull(),
  },
  (row) => [
    uniqueIndex('timeline_sequence').on(row.agentId, row.sequence),
    uniqueIndex('timeline_active')
      .on(row.agentId)
      .where(sql`${row.phase} IN ('reserved', 'decided')`),
  ],
);
