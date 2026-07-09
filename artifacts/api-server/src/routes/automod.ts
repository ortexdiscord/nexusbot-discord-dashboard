import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { automodConfigTable, automodEventsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { UpdateAutomodConfigBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/automod", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(automodConfigTable).where(eq(automodConfigTable.guildId, guildId));

  if (rows.length === 0) {
    res.json({
      guildId,
      enabled: false,
      antiSpam: false,
      antiLinks: false,
      antiProfanity: false,
      maxMentions: 5,
      logChannelId: null,
      bannedWords: [],
      allowedLinks: [],
      aiAutomodEnabled: false,
      aiAutomodSensitivity: "medium",
      aiAutomodAction: "delete",
    });
    return;
  }

  res.json(rows[0]);
});

router.patch("/automod", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = UpdateAutomodConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const existing = await db.select().from(automodConfigTable).where(eq(automodConfigTable.guildId, guildId));

  let config;
  if (existing.length === 0) {
    const [inserted] = await db.insert(automodConfigTable).values({
      guildId,
      enabled: parsed.data.enabled ?? false,
      antiSpam: parsed.data.antiSpam ?? false,
      antiLinks: parsed.data.antiLinks ?? false,
      antiProfanity: parsed.data.antiProfanity ?? false,
      maxMentions: parsed.data.maxMentions ?? 5,
      logChannelId: parsed.data.logChannelId ?? null,
      bannedWords: parsed.data.bannedWords ?? [],
      allowedLinks: parsed.data.allowedLinks ?? [],
      aiAutomodEnabled: parsed.data.aiAutomodEnabled ?? false,
      aiAutomodSensitivity: parsed.data.aiAutomodSensitivity ?? "medium",
      aiAutomodAction: parsed.data.aiAutomodAction ?? "delete",
    }).returning();
    config = inserted;
  } else {
    const [updated] = await db.update(automodConfigTable)
      .set(parsed.data)
      .where(eq(automodConfigTable.guildId, guildId))
      .returning();
    config = updated;
  }

  res.json(config);
});

router.get("/automod/events", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const events = await db.select().from(automodEventsTable)
    .where(eq(automodEventsTable.guildId, guildId))
    .orderBy(desc(automodEventsTable.createdAt))
    .limit(100);
  res.json(events.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })));
});

export default router;
