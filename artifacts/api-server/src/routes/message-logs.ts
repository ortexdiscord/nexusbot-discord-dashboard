import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { messageLogsTable, messageLogConfigTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router({ mergeParams: true });

// Get config
router.get("/message-logs/config", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(messageLogConfigTable).where(eq(messageLogConfigTable.guildId, guildId));
  if (rows.length === 0) {
    res.json({ guildId, enabled: false, logChannelId: null, logEdits: true, logDeletes: true });
    return;
  }
  res.json(rows[0]);
});

// Update config
router.patch("/message-logs/config", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const body = req.body as { enabled?: boolean; logChannelId?: string | null; logEdits?: boolean; logDeletes?: boolean };
  const existing = await db.select().from(messageLogConfigTable).where(eq(messageLogConfigTable.guildId, guildId));
  let config;
  if (existing.length === 0) {
    [config] = await db.insert(messageLogConfigTable).values({ guildId, ...body }).returning();
  } else {
    [config] = await db.update(messageLogConfigTable).set(body).where(eq(messageLogConfigTable.guildId, guildId)).returning();
  }
  res.json(config);
});

// Get recent logs
router.get("/message-logs", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const type = req.query["type"] as string | undefined;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);

  let query = db.select().from(messageLogsTable).where(
    type
      ? and(eq(messageLogsTable.guildId, guildId), eq(messageLogsTable.type, type))
      : eq(messageLogsTable.guildId, guildId)
  );

  const rows = await (query as any).orderBy(desc(messageLogsTable.createdAt)).limit(limit);
  res.json(rows);
});

export default router;
