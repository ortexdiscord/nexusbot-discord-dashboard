import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moderationLogsTable = pgTable("moderation_logs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  type: text("type").notNull(), // ban, kick, mute, unmute, warn
  targetUserId: text("target_user_id").notNull(),
  targetUsername: text("target_username").notNull(),
  moderatorId: text("moderator_id").notNull(),
  moderatorUsername: text("moderator_username").notNull(),
  reason: text("reason").notNull(),
  duration: integer("duration"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertModerationLogSchema = createInsertSchema(moderationLogsTable).omit({ id: true, createdAt: true });
export type InsertModerationLog = z.infer<typeof insertModerationLogSchema>;
export type ModerationLog = typeof moderationLogsTable.$inferSelect;

export const warningsTable = pgTable("warnings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  moderatorId: text("moderator_id").notNull(),
  moderatorUsername: text("moderator_username").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWarningSchema = createInsertSchema(warningsTable).omit({ id: true, createdAt: true });
export type InsertWarning = z.infer<typeof insertWarningSchema>;
export type Warning = typeof warningsTable.$inferSelect;

export const punishmentThresholdsTable = pgTable("punishment_thresholds", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  thresholds: jsonb("thresholds").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PunishmentThresholds = typeof punishmentThresholdsTable.$inferSelect;
