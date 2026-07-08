import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";

export const webhookLogsTable = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  message: text("message").notNull(),
  embedEnabled: boolean("embed_enabled").notNull().default(false),
  embedColor: text("embed_color").notNull().default("#7C3AED"),
  embedTitle: text("embed_title"),
  embedDescription: text("embed_description"),
  imageUrl: text("image_url"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  sentByUserId: text("sent_by_user_id"),
  sentByUsername: text("sent_by_username"),
});
