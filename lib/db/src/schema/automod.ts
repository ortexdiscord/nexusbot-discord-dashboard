import { pgTable, text, integer, boolean, timestamp, serial, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const automodConfigTable = pgTable("automod_config", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  antiSpam: boolean("anti_spam").notNull().default(false),
  antiLinks: boolean("anti_links").notNull().default(false),
  antiProfanity: boolean("anti_profanity").notNull().default(false),
  maxMentions: integer("max_mentions").notNull().default(5),
  logChannelId: text("log_channel_id"),
  bannedWords: text("banned_words").array().notNull().default([]),
  allowedLinks: text("allowed_links").array().notNull().default([]),
  // AI Automod
  aiAutomodEnabled: boolean("ai_automod_enabled").notNull().default(false),
  aiAutomodSensitivity: text("ai_automod_sensitivity").notNull().default("medium"), // 'low' | 'medium' | 'high'
  aiAutomodAction: text("ai_automod_action").notNull().default("delete"), // 'delete' | 'warn' | 'mute'
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAutomodConfigSchema = createInsertSchema(automodConfigTable).omit({ updatedAt: true });
export type InsertAutomodConfig = z.infer<typeof insertAutomodConfigSchema>;
export type AutomodConfig = typeof automodConfigTable.$inferSelect;

export const automodEventsTable = pgTable("automod_events", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  channelId: text("channel_id").notNull(),
  content: text("content").notNull(),
  reason: text("reason"),
  score: real("score"),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AutomodEvent = typeof automodEventsTable.$inferSelect;
