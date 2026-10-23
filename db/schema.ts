import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Owner is part of every key, including subscription and message lookup keys.
export const relayRecords = sqliteTable(
  "relay_records",
  {
    owner: text("owner").notNull(),
    kind: text("kind").notNull(),
    id: text("id").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at"),
  },
  (table) => [
    primaryKey({ columns: [table.owner, table.kind, table.id] }),
    index("relay_lookup_idx").on(table.kind, table.id),
    index("relay_timeline_idx").on(table.owner, table.kind, sql`json_extract(${table.value}, '$.createdAt')`),
    index("relay_pending_idx")
      .on(table.owner, sql`json_extract(${table.value}, '$.createdAt')`)
      .where(sql`${table.kind} = 'utterance' AND json_extract(${table.value}, '$.status') != 'replied'`),
  ],
);
