import { pgTable, serial, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const rulesTable = pgTable(
  "rules",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    ruleKey: text("rule_key").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    guildKeyIdx: uniqueIndex("rules_guild_key_idx").on(table.guildId, table.ruleKey),
  }),
);

export type Rule = typeof rulesTable.$inferSelect;
