import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { reactionRolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateReactionRoleBody, UpdateReactionRoleBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/reaction-roles", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const roles = await db.select().from(reactionRolesTable).where(eq(reactionRolesTable.guildId, guildId));
  res.json(roles);
});

router.post("/reaction-roles", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const parsed = CreateReactionRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [created] = await db.insert(reactionRolesTable).values({
    guildId,
    ...parsed.data,
  }).returning();
  res.status(201).json(created);
});

router.patch("/reaction-roles/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  const parsed = UpdateReactionRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [updated] = await db.update(reactionRolesTable)
    .set(parsed.data)
    .where(and(eq(reactionRolesTable.id, id), eq(reactionRolesTable.guildId, guildId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/reaction-roles/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(reactionRolesTable).where(and(eq(reactionRolesTable.id, id), eq(reactionRolesTable.guildId, guildId)));
  res.status(204).send();
});

export default router;
