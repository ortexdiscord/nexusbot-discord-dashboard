import { pgTable, text, serial, boolean, integer, jsonb, timestamp, bigint, uniqueIndex } from "drizzle-orm/pg-core";

export const xpSettingsTable = pgTable("xp_settings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  minXpPerMessage: integer("min_xp_per_message").notNull().default(15),
  maxXpPerMessage: integer("max_xp_per_message").notNull().default(40),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(60),
  levelUpChannelId: text("level_up_channel_id"), // null = same channel, "dm" = DM
  levelUpMessage: text("level_up_message").notNull().default("🎉 {user} has reached **level {level}**!"),
  stackRoles: boolean("stack_roles").notNull().default(true), // keep all earned roles
  noXpRoles: jsonb("no_xp_roles").notNull().default([]), // array of roleIds
  noXpChannels: jsonb("no_xp_channels").notNull().default([]), // array of channelIds
  multipliers: jsonb("multipliers").notNull().default([]), // [{type:"role"|"channel", id, multiplier}]
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userXpTable = pgTable("user_xp", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username"),
  avatarUrl: text("avatar_url"),
  xp: bigint("xp", { mode: "number" }).notNull().default(0),
  level: integer("level").notNull().default(0),
  messages: integer("messages").notNull().default(0),
  lastMessage: timestamp("last_message", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  guildUserUnique: uniqueIndex("user_xp_guild_user_unique").on(t.guildId, t.userId),
}));

export type XpSettings = typeof xpSettingsTable.$inferSelect;
export type UserXp = typeof userXpTable.$inferSelect;

// Helper: XP required to reach a given level (Arcane formula: 5 * level^2 + 50*level + 100)
export function xpForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

// Total XP needed from level 0 to reach this level
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += xpForLevel(i);
  return total;
}
