import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { pollsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreatePollBody } from "@workspace/api-zod";

const POLL_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const router = Router({ mergeParams: true });

router.get("/polls", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const polls = await db.select().from(pollsTable).where(eq(pollsTable.guildId, guildId));
  res.json(polls.map(p => ({
    ...p,
    options: p.options as Array<{ emoji: string; text: string; votes: number }>,
    createdAt: p.createdAt.toISOString(),
    endsAt: p.endsAt ? p.endsAt.toISOString() : null,
  })));
});

router.post("/polls", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = CreatePollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const options = parsed.data.options.map((text, i) => ({
    emoji: POLL_EMOJIS[i] || String(i + 1),
    text,
    votes: 0,
  }));

  const [created] = await db.insert(pollsTable).values({
    guildId,
    channelId: parsed.data.channelId,
    question: parsed.data.question,
    options,
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
  }).returning();

  res.status(201).json({
    ...created,
    options: created.options as Array<{ emoji: string; text: string; votes: number }>,
    createdAt: created.createdAt.toISOString(),
    endsAt: created.endsAt ? created.endsAt.toISOString() : null,
  });
});

router.get("/polls/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  const rows = await db.select().from(pollsTable).where(and(eq(pollsTable.id, id), eq(pollsTable.guildId, guildId)));
  if (rows.length === 0) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  const p = rows[0];
  res.json({
    ...p,
    options: p.options as Array<{ emoji: string; text: string; votes: number }>,
    createdAt: p.createdAt.toISOString(),
    endsAt: p.endsAt ? p.endsAt.toISOString() : null,
  });
});

router.delete("/polls/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(pollsTable).where(and(eq(pollsTable.id, id), eq(pollsTable.guildId, guildId)));
  res.status(204).send();
});

export default router;
