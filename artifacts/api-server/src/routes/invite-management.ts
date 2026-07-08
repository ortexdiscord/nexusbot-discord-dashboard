import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { invitesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireSession } from "../lib/require-session";

const router = Router({ mergeParams: true });

// GET /guilds/:guildId/invite-management — list recent joins with inviter info
router.get("/invite-management", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  try {
    const rows = await db.select().from(invitesTable)
      .where(eq(invitesTable.guildId, guildId))
      .orderBy(desc(invitesTable.invitedAt))
      .limit(100);
    res.json(rows.map(r => ({ ...r, invitedAt: r.invitedAt.toISOString() })));
  } catch {
    res.json([]);
  }
});

// GET /guilds/:guildId/invite-management/leaderboard — top inviters
router.get("/invite-management/leaderboard", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  try {
    const rows = await db.select({
      inviterUserId: invitesTable.inviterUserId,
      inviterUsername: invitesTable.inviterUsername,
      inviteCount: sql<number>`count(*)::int`,
    })
      .from(invitesTable)
      .where(eq(invitesTable.guildId, guildId))
      .groupBy(invitesTable.inviterUserId, invitesTable.inviterUsername)
      .orderBy(desc(sql`count(*)`))
      .limit(10);
    res.json(rows.filter(r => r.inviterUserId));
  } catch {
    res.json([]);
  }
});

export default router;
