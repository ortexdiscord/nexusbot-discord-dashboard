import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const statsChannelsTable = pgTable("stats_channels", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  membersChannelId: text("members_channel_id"),
  onlineChannelId: text("online_channel_id"),
  botsChannelId: text("bots_channel_id"),
  boostsChannelId: text("boosts_channel_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type StatsChannels = typeof statsChannelsTable.$inferSelect;
