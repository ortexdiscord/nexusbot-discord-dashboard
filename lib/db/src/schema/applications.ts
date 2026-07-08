import { pgTable, text, serial, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  questions: jsonb("questions").notNull().default([]), // Array of {id, question, required}
  responseChannelId: text("response_channel_id"),
  panelChannelId: text("panel_channel_id"),
  panelMessageId: text("panel_message_id"),
  acceptedRoleId: text("accepted_role_id"),
  acceptedRoleName: text("accepted_role_name"),
  enabled: boolean("enabled").notNull().default(true),
  color: text("color").notNull().default("#7C3AED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Application = typeof applicationsTable.$inferSelect;
