import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { statsChannelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/stats-channels", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(statsChannelsTable).where(eq(statsChannelsTable.guildId, guildId));
  if (rows.length === 0) {
    res.json({
      guildId,
      enabled: false,
      membersChannelId: null,
      onlineChannelId: null,
      botsChannelId: null,
      boostsChannelId: null,
    });
    return;
  }
  res.json(rows[0]);
});

router.patch("/stats-channels", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const body = req.body as {
    enabled?: boolean;
    membersChannelId?: string | null;
    onlineChannelId?: string | null;
    botsChannelId?: string | null;
    boostsChannelId?: string | null;
  };

  const existing = await db.select().from(statsChannelsTable).where(eq(statsChannelsTable.guildId, guildId));
  let config;
  if (existing.length === 0) {
    const [inserted] = await db.insert(statsChannelsTable).values({ guildId, ...body }).returning();
    config = inserted;
  } else {
    const [updated] = await db.update(statsChannelsTable).set(body).where(eq(statsChannelsTable.guildId, guildId)).returning();
    config = updated;
  }
  res.json(config);
});

export default router;
