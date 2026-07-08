import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const webhookConfigsTable = pgTable("webhook_configs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  webhookId: text("webhook_id").notNull(),
  webhookToken: text("webhook_token").notNull(),
  name: text("name").notNull().default("NexusBot"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WebhookConfig = typeof webhookConfigsTable.$inferSelect;
