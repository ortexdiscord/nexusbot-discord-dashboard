import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { moderationLogsTable, warningsTable, punishmentThresholdsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  BanUserBody,
  KickUserBody,
  MuteUserBody,
  CreateWarningBody,
} from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/moderation", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const logs = await db
    .select()
    .from(moderationLogsTable)
    .where(eq(moderationLogsTable.guildId, guildId))
    .orderBy(desc(moderationLogsTable.createdAt))
    .limit(50);

  res.json(logs.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  })));
});

router.post("/moderation/ban", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = BanUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { userId, reason } = parsed.data;
  const user = (req.session as any).user;
  const [log] = await db.insert(moderationLogsTable).values({
    guildId,
    type: "ban",
    targetUserId: userId,
    targetUsername: `User#${userId.slice(-4)}`,
    moderatorId: user?.id || "system",
    moderatorUsername: user?.username || "System",
    reason,
  }).returning();
  res.json({ ...log, createdAt: log.createdAt.toISOString() });
});

router.post("/moderation/kick", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = KickUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { userId, reason } = parsed.data;
  const user = (req.session as any).user;
  const [log] = await db.insert(moderationLogsTable).values({
    guildId,
    type: "kick",
    targetUserId: userId,
    targetUsername: `User#${userId.slice(-4)}`,
    moderatorId: user?.id || "system",
    moderatorUsername: user?.username || "System",
    reason,
  }).returning();
  res.json({ ...log, createdAt: log.createdAt.toISOString() });
});

router.post("/moderation/mute", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = MuteUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { userId, reason, duration } = parsed.data;
  const user = (req.session as any).user;
  const [log] = await db.insert(moderationLogsTable).values({
    guildId,
    type: "mute",
    targetUserId: userId,
    targetUsername: `User#${userId.slice(-4)}`,
    moderatorId: user?.id || "system",
    moderatorUsername: user?.username || "System",
    reason,
    duration,
  }).returning();
  res.json({ ...log, createdAt: log.createdAt.toISOString() });
});

router.get("/warnings", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const warnings = await db
    .select()
    .from(warningsTable)
    .where(eq(warningsTable.guildId, guildId))
    .orderBy(desc(warningsTable.createdAt));
  res.json(warnings.map(w => ({ ...w, createdAt: w.createdAt.toISOString() })));
});

router.post("/warnings", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = CreateWarningBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [warning] = await db.insert(warningsTable).values({
    guildId,
    ...parsed.data,
  }).returning();
  res.status(201).json({ ...warning, createdAt: warning.createdAt.toISOString() });
});

router.delete("/warnings/:warningId", async (req: Request, res: Response) => {
  const warningId = parseInt(String(req.params["warningId"] ?? "0"));
  await db.delete(warningsTable).where(eq(warningsTable.id, warningId));
  res.status(204).send();
});

router.get("/punishment-thresholds", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const [row] = await db.select().from(punishmentThresholdsTable).where(eq(punishmentThresholdsTable.guildId, guildId));
  res.json(row ?? { guildId, enabled: false, thresholds: [] });
});

router.put("/punishment-thresholds", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const { enabled, thresholds } = req.body;
  const existing = await db.select().from(punishmentThresholdsTable).where(eq(punishmentThresholdsTable.guildId, guildId));
  let row;
  if (existing.length === 0) {
    [row] = await db.insert(punishmentThresholdsTable).values({ guildId, enabled: !!enabled, thresholds: thresholds ?? [] }).returning();
  } else {
    [row] = await db.update(punishmentThresholdsTable).set({ enabled: !!enabled, thresholds: thresholds ?? [], updatedAt: new Date() }).where(eq(punishmentThresholdsTable.guildId, guildId)).returning();
  }
  res.json(row);
});

export default router;
