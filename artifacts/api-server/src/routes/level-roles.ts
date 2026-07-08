import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { levelRolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateLevelRoleBody, UpdateLevelRoleBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/level-roles", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(levelRolesTable).where(eq(levelRolesTable.guildId, guildId));
  res.json(rows);
});

router.post("/level-roles", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = CreateLevelRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [created] = await db.insert(levelRolesTable).values({
    guildId,
    ...parsed.data,
  }).returning();
  res.status(201).json(created);
});

router.patch("/level-roles/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  const parsed = UpdateLevelRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [updated] = await db.update(levelRolesTable)
    .set(parsed.data)
    .where(and(eq(levelRolesTable.id, id), eq(levelRolesTable.guildId, guildId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/level-roles/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(levelRolesTable).where(and(eq(levelRolesTable.id, id), eq(levelRolesTable.guildId, guildId)));
  res.status(204).send();
});

export default router;
