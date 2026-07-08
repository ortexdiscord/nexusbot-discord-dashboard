import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const ticketSettingsTable = pgTable("ticket_settings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  panelChannelId: text("panel_channel_id"),
  categoryId: text("category_id"),
  supportRoleId: text("support_role_id"),
  supportRoleName: text("support_role_name"),
  logChannelId: text("log_channel_id"),
  panelTitle: text("panel_title").notNull().default("Support Tickets"),
  panelDescription: text("panel_description").notNull().default("Click the button below to open a support ticket."),
  panelColor: text("panel_color").notNull().default("#7C3AED"),
  ticketMessage: text("ticket_message").notNull().default("Thank you for opening a ticket. A staff member will be with you shortly."),
  maxOpenTickets: integer("max_open_tickets").notNull().default(1),
  panelMessageId: text("panel_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const openTicketsTable = pgTable("open_tickets", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("open"), // "open" | "closed"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export type TicketSettings = typeof ticketSettingsTable.$inferSelect;
export type OpenTicket = typeof openTicketsTable.$inferSelect;
