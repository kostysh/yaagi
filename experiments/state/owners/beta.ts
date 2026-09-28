import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { notes } from "./alpha.js";

export const marks = sqliteTable("fixture_marks", {
  id: text().primaryKey(),
  noteId: text()
    .notNull()
    .references(() => notes.id),
  amount: integer().notNull(),
});
