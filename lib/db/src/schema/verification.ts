import { pgTable, text, boolean, serial, timestamp } from "drizzle-orm/pg-core";

export const verificationConfigTable = pgTable("verification_config", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  type: text("type").notNull().default("captcha"), // 'captcha' | 'ticket'
  verifiedRoleId: text("verified_role_id"),
  unverifiedRoleId: text("unverified_role_id"),
  channelId: text("channel_id"),  // channel where captcha/verify happens
  logChannelId: text("log_channel_id"),
  categoryId: text("category_id"), // category to hide after verification
  welcomeMessage: text("welcome_message").default("Please verify yourself to gain access!"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const verificationLogsTable = pgTable("verification_logs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  type: text("type").notNull(), // 'captcha' | 'ticket'
  status: text("status").notNull(), // 'verified' | 'failed' | 'pending'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VerificationConfig = typeof verificationConfigTable.$inferSelect;
export type VerificationLog = typeof verificationLogsTable.$inferSelect;
