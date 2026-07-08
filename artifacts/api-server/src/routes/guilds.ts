import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  moderationLogsTable,
  warningsTable,
  reactionRolesTable,
  customCommandsTable,
  remindersTable,
  pollsTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { getBotGuilds, getBotGuildDetail } from "../bot";

const router = Router();

// Fallback mock guilds when bot isn't connected
const MOCK_GUILDS = [
  { id: "111111111111111111", name: "Gaming HQ", icon: null, memberCount: 1247, botPresent: true },
  { id: "222222222222222222", name: "Dev Community", icon: null, memberCount: 538, botPresent: true },
  { id: "333333333333333333", name: "Art & Design", icon: null, memberCount: 892, botPresent: true },
];

const MOCK_CHANNELS = [
  { id: "ch001", name: "general", type: "text" },
  { id: "ch002", name: "announcements", type: "text" },
  { id: "ch003", name: "mods-only", type: "text" },
  { id: "ch004", name: "bot-commands", type: "text" },
];

const MOCK_ROLES = [
  { id: "r001", name: "Admin", color: 0xe74c3c },
  { id: "r002", name: "Moderator", color: 0x9b59b6 },
  { id: "r003", name: "Member", color: 0x3498db },
  { id: "r004", name: "Verified", color: 0x2ecc71 },
  { id: "r005", name: "VIP", color: 0xf1c40f },
];

router.get("/", (_req: Request, res: Response) => {
  const botGuilds = getBotGuilds();
  res.json(botGuilds.length > 0 ? botGuilds : MOCK_GUILDS);
});

router.get("/:guildId", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const detail = await getBotGuildDetail(guildId);
  if (detail) {
    res.json(detail);
    return;
  }
  const mock = MOCK_GUILDS.find(g => g.id === guildId);
  if (!mock) {
    res.status(404).json({ error: "Guild not found" });
    return;
  }
  res.json({ ...mock, channels: MOCK_CHANNELS, roles: MOCK_ROLES });
});

router.get("/:guildId/stats", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  try {
    const [warnings] = await db.select({ count: count() }).from(warningsTable).where(eq(warningsTable.guildId, guildId));
    const [bans] = await db.select({ count: count() }).from(moderationLogsTable).where(eq(moderationLogsTable.guildId, guildId));
    const [reactionRoles] = await db.select({ count: count() }).from(reactionRolesTable).where(eq(reactionRolesTable.guildId, guildId));
    const [commands] = await db.select({ count: count() }).from(customCommandsTable).where(eq(customCommandsTable.guildId, guildId));
    const [reminders] = await db.select({ count: count() }).from(remindersTable).where(eq(remindersTable.guildId, guildId));
    const [polls] = await db.select({ count: count() }).from(pollsTable).where(eq(pollsTable.guildId, guildId));

    res.json({
      guildId,
      totalWarnings: Number(warnings?.count ?? 0),
      totalBans: Number(bans?.count ?? 0),
      totalMutes: 0,
      totalKicks: 0,
      activeReminders: Number(reminders?.count ?? 0),
      activePolls: Number(polls?.count ?? 0),
      customCommands: Number(commands?.count ?? 0),
      reactionRoles: Number(reactionRoles?.count ?? 0),
    });
  } catch {
    res.json({
      guildId,
      totalWarnings: 0, totalBans: 0, totalMutes: 0, totalKicks: 0,
      activeReminders: 0, activePolls: 0, customCommands: 0, reactionRoles: 0,
    });
  }
});

export default router;
