import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const messageLogConfigTable = pgTable("message_log_config", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  logChannelId: text("log_channel_id"),
  logEdits: boolean("log_edits").notNull().default(true),
  logDeletes: boolean("log_deletes").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type MessageLogConfig = typeof messageLogConfigTable.$inferSelect;
