import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { remindersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateReminderBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/reminders", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const reminders = await db.select().from(remindersTable).where(eq(remindersTable.guildId, guildId));
  res.json(reminders.map(r => ({
    ...r,
    scheduledAt: r.scheduledAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/reminders", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = CreateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [created] = await db.insert(remindersTable).values({
    guildId,
    channelId: parsed.data.channelId,
    userId: parsed.data.userId,
    message: parsed.data.message,
    scheduledAt: new Date(parsed.data.scheduledAt),
  }).returning();
  res.status(201).json({
    ...created,
    scheduledAt: created.scheduledAt.toISOString(),
    createdAt: created.createdAt.toISOString(),
  });
});

router.delete("/reminders/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(remindersTable).where(and(eq(remindersTable.id, id), eq(remindersTable.guildId, guildId)));
  res.status(204).send();
});

export default router;
