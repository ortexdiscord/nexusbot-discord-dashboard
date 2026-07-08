import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const selfRolesTable = pgTable("self_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  category: text("category").notNull(), // "gender" | "age" | "device"
  emoji: text("emoji").notNull(),
  label: text("label").notNull(),
  roleId: text("role_id").notNull(),
  roleName: text("role_name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SelfRole = typeof selfRolesTable.$inferSelect;
