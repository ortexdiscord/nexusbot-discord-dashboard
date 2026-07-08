import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { xpSettingsTable, userXpTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/xp-settings", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const [row] = await db.select().from(xpSettingsTable).where(eq(xpSettingsTable.guildId, guildId));
  res.json(row ?? null);
});

router.put("/xp-settings", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const body = req.body as Partial<typeof xpSettingsTable.$inferInsert>;
  const existing = await db.select().from(xpSettingsTable).where(eq(xpSettingsTable.guildId, guildId));

  if (existing.length) {
    const [updated] = await db.update(xpSettingsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(xpSettingsTable.guildId, guildId))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(xpSettingsTable).values({ guildId, ...body }).returning();
    res.json(created);
  }
});

router.get("/xp-leaderboard", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const limit = Math.min(parseInt(String(req.query["limit"] ?? "50")), 100);
  // Rank by level DESC first (real rank), then by remaining xp within that level
  const rows = await db.select().from(userXpTable)
    .where(eq(userXpTable.guildId, guildId))
    .orderBy(desc(userXpTable.level), desc(userXpTable.xp))
    .limit(limit);
  res.json(rows);
});

router.delete("/xp-leaderboard/:userId", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const userId = String(req.params["userId"]);
  await db.delete(userXpTable)
    .where(and(eq(userXpTable.guildId, guildId), eq(userXpTable.userId, userId)));
  res.status(204).send();
});

export default router;
