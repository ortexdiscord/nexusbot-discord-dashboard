import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

// Generic analytics event log used for the Summary dashboard graphs
export const analyticsEventsTable = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  type: text("type").notNull(),
  // Types: 'member_join' | 'member_leave' | 'command_used' | 'verification_pass' | 'verification_fail'
  meta: text("meta"), // JSON string for extra data e.g. command name
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
