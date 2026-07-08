import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const levelRolesTable = pgTable("level_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  level: integer("level").notNull(),
  roleId: text("role_id").notNull(),
  roleName: text("role_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLevelRoleSchema = createInsertSchema(levelRolesTable).omit({ id: true, createdAt: true });
export type InsertLevelRole = z.infer<typeof insertLevelRoleSchema>;
export type LevelRole = typeof levelRolesTable.$inferSelect;
