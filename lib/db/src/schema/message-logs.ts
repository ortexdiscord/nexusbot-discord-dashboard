import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const messageLogsTable = pgTable("message_logs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  channelName: text("channel_name").notNull().default("unknown"),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  messageId: text("message_id").notNull(),
  type: text("type").notNull(), // 'edit' | 'delete'
  oldContent: text("old_content"),
  newContent: text("new_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MessageLog = typeof messageLogsTable.$inferSelect;
