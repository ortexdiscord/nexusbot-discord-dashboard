import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const invitesTable = pgTable("invites", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  invitedUserId: text("invited_user_id").notNull(),
  invitedUsername: text("invited_username").notNull(),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  inviterUserId: text("inviter_user_id"),
  inviterUsername: text("inviter_username"),
  inviteCode: text("invite_code"),
  isBot: boolean("is_bot").default(false).notNull(),
  isOAuth: boolean("is_oauth").default(false).notNull(),
});
