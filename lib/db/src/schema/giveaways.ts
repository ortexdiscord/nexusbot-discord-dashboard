import { pgTable, text, integer, boolean, timestamp, serial, jsonb } from "drizzle-orm/pg-core";

export const giveawaysTable = pgTable("giveaways", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  prize: text("prize").notNull(),
  winnerCount: integer("winner_count").notNull().default(1),
  requiredRoleId: text("required_role_id"),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  ended: boolean("ended").notNull().default(false),
  winners: jsonb("winners").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Giveaway = typeof giveawaysTable.$inferSelect;
