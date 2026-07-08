import { pgTable, text, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const alwaysOnlineTable = pgTable("always_online", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  channelId: text("channel_id"),
  intervalMinutes: integer("interval_minutes").notNull().default(60),
  message: text("message").notNull().default("NexusBot is online and ready!"),
  embedEnabled: boolean("embed_enabled").notNull().default(false),
  embedColor: text("embed_color").notNull().default("#7C3AED"),
  embedTitle: text("embed_title"),
  embedDescription: text("embed_description"),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
