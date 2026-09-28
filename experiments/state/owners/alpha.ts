import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";

export const notes = sqliteTable("fixture_notes", {
  id: text().primaryKey(),
  text: text().notNull(),
  revision: integer().notNull(),
  bytes: blob({ mode: "buffer" }).notNull(),
  tag: text(),
});
export const Note = z.object({
  id: z.string().min(1),
  text: z.string(),
  revision: z.number().int().nonnegative(),
  bytes: z.instanceof(Uint8Array),
});
