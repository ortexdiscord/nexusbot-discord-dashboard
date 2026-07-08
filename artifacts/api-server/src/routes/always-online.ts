import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { alwaysOnlineTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/always-online", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(alwaysOnlineTable).where(eq(alwaysOnlineTable.guildId, guildId));
  if (rows.length === 0) {
    res.json({
      guildId,
      enabled: false,
      channelId: null,
      intervalMinutes: 60,
      message: "Umbra Utilities is online and ready!",
      embedEnabled: false,
      embedColor: "#7C3AED",
      embedTitle: null,
      embedDescription: null,
      lastSentAt: null,
    });
    return;
  }
  res.json({
    ...rows[0],
    lastSentAt: rows[0].lastSentAt ? rows[0].lastSentAt.toISOString() : null,
    createdAt: rows[0].createdAt.toISOString(),
  });
});

router.patch("/always-online", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const body = req.body as {
    enabled?: boolean;
    channelId?: string | null;
    intervalMinutes?: number;
    message?: string;
    embedEnabled?: boolean;
    embedColor?: string;
    embedTitle?: string | null;
    embedDescription?: string | null;
  };

  const existing = await db.select().from(alwaysOnlineTable).where(eq(alwaysOnlineTable.guildId, guildId));
  let config;
  if (existing.length === 0) {
    const [inserted] = await db.insert(alwaysOnlineTable).values({
      guildId,
      message: "Umbra Utilities is online and ready!",
      embedColor: "#7C3AED",
      ...body,
    }).returning();
    config = inserted;
  } else {
    const [updated] = await db.update(alwaysOnlineTable)
      .set(body)
      .where(eq(alwaysOnlineTable.guildId, guildId))
      .returning();
    config = updated;
  }

  res.json({
    ...config,
    lastSentAt: config.lastSentAt ? config.lastSentAt.toISOString() : null,
    createdAt: config.createdAt.toISOString(),
  });
});

export default router;
