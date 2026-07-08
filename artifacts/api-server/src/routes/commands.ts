import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { customCommandsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateCustomCommandBody, UpdateCustomCommandBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/commands", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const commands = await db.select().from(customCommandsTable).where(eq(customCommandsTable.guildId, guildId));
  res.json(commands.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/commands", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = CreateCustomCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [created] = await db.insert(customCommandsTable).values({
    guildId,
    ...parsed.data,
    enabled: parsed.data.enabled ?? true,
  }).returning();
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

router.patch("/commands/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  const parsed = UpdateCustomCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [updated] = await db.update(customCommandsTable)
    .set(parsed.data)
    .where(and(eq(customCommandsTable.id, id), eq(customCommandsTable.guildId, guildId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/commands/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(customCommandsTable).where(and(eq(customCommandsTable.id, id), eq(customCommandsTable.guildId, guildId)));
  res.status(204).send();
});

export default router;
