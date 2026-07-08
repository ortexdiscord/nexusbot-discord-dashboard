import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const welcomeConfigTable = pgTable("welcome_config", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  channelId: text("channel_id"),
  message: text("message").notNull().default("Welcome to the server, {user}!"),
  embedEnabled: boolean("embed_enabled").notNull().default(false),
  embedColor: text("embed_color").notNull().default("#7C3AED"),
  embedTitle: text("embed_title"),
  embedDescription: text("embed_description"),
  assignRoleId: text("assign_role_id"),
  // Image card fields
  imageCardEnabled: boolean("image_card_enabled").notNull().default(false),
  imageCardBgUrl: text("image_card_bg_url"),
  imageCardText: text("image_card_text").default("Welcome, {user}!"),
  imageCardSubtext: text("image_card_subtext").default("Member #{count}"),
  // Join DM
  dmEnabled: boolean("dm_enabled").notNull().default(false),
  dmMessage: text("dm_message").default("Welcome to **{server}**! We're glad to have you. 🎉"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWelcomeConfigSchema = createInsertSchema(welcomeConfigTable).omit({ updatedAt: true });
export type InsertWelcomeConfig = z.infer<typeof insertWelcomeConfigSchema>;
export type WelcomeConfig = typeof welcomeConfigTable.$inferSelect;
