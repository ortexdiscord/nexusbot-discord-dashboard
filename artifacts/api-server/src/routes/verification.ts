import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { verificationConfigTable, verificationLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/verification", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(verificationConfigTable).where(eq(verificationConfigTable.guildId, guildId));
  if (rows.length === 0) {
    res.json({
      guildId, enabled: false, type: "captcha",
      verifiedRoleId: null, unverifiedRoleId: null,
      channelId: null, logChannelId: null, categoryId: null,
      welcomeMessage: "Please verify yourself to gain access!",
    });
    return;
  }
  res.json(rows[0]);
});

router.patch("/verification", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const body = req.body as {
    enabled?: boolean; type?: string;
    verifiedRoleId?: string | null; unverifiedRoleId?: string | null;
    channelId?: string | null; logChannelId?: string | null;
    categoryId?: string | null; welcomeMessage?: string;
  };
  const existing = await db.select().from(verificationConfigTable).where(eq(verificationConfigTable.guildId, guildId));
  let config;
  if (existing.length === 0) {
    [config] = await db.insert(verificationConfigTable).values({ guildId, ...body }).returning();
  } else {
    [config] = await db.update(verificationConfigTable).set(body).where(eq(verificationConfigTable.guildId, guildId)).returning();
  }
  res.json(config);
});

// Recent verification logs
router.get("/verification/logs", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const rows = await db.select().from(verificationLogsTable)
    .where(eq(verificationLogsTable.guildId, guildId))
    .orderBy(desc(verificationLogsTable.createdAt))
    .limit(limit);
  res.json(rows);
});

export default router;
