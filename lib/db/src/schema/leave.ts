import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leaveConfigTable = pgTable("leave_config", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  channelId: text("channel_id"),
  message: text("message").notNull().default("Goodbye, {user}! We hope to see you again."),
  embedEnabled: boolean("embed_enabled").notNull().default(false),
  embedColor: text("embed_color").notNull().default("#7C3AED"),
  embedTitle: text("embed_title"),
  embedDescription: text("embed_description"),
  // Image card fields
  imageCardEnabled: boolean("image_card_enabled").notNull().default(false),
  imageCardBgUrl: text("image_card_bg_url"),
  imageCardText: text("image_card_text").default("Goodbye, {user}!"),
  imageCardSubtext: text("image_card_subtext").default("We now have {count} members"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeaveConfigSchema = createInsertSchema(leaveConfigTable).omit({ updatedAt: true });
export type InsertLeaveConfig = z.infer<typeof insertLeaveConfigSchema>;
export type LeaveConfig = typeof leaveConfigTable.$inferSelect;
