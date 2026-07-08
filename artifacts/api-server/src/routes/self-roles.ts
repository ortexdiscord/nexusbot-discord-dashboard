import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { selfRolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getBotClient } from "../bot/index";
import { EmbedBuilder } from "discord.js";

const router = Router({ mergeParams: true });

router.get("/self-roles", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(selfRolesTable).where(eq(selfRolesTable.guildId, guildId));
  res.json(rows);
});

router.post("/self-roles", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const { category, emoji, label, roleId, roleName, description } = req.body as {
    category: string; emoji: string; label: string; roleId: string; roleName: string; description?: string;
  };
  if (!category || !emoji || !label || !roleId || !roleName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const [created] = await db.insert(selfRolesTable).values({
    guildId, category, emoji, label, roleId, roleName, description: description ?? null,
  }).returning();
  res.status(201).json(created);
});

router.delete("/self-roles/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(selfRolesTable).where(and(eq(selfRolesTable.id, id), eq(selfRolesTable.guildId, guildId)));
  res.status(204).send();
});

// POST /guilds/:guildId/self-roles/send  — send configured embed to a channel
router.post("/self-roles/send", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const { channelId, category, bannerImageUrl } = req.body as { channelId: string; category: string; bannerImageUrl?: string };
  if (!channelId || !category) { res.status(400).json({ error: "channelId and category required" }); return; }

  const client = getBotClient();
  if (!client) { res.status(503).json({ error: "Bot not connected" }); return; }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Guild not found" }); return; }

  const channel = guild.channels.cache.get(channelId) as any;
  if (!channel?.isTextBased()) { res.status(404).json({ error: "Channel not found" }); return; }

  const roles = await db.select().from(selfRolesTable).where(
    and(eq(selfRolesTable.guildId, guildId), eq(selfRolesTable.category, category))
  );
  if (!roles.length) { res.status(400).json({ error: "No roles configured for this category" }); return; }

  const categoryTitles: Record<string, { title: string; description: string; color: number }> = {
    gender: { title: "🚹🚫🚺 | What is your gender?", description: "You can choose your gender below. Click on the emojis to obtain the roles.", color: 0xb0c4de },
    age:    { title: "| What's your age?", description: "You can get age roles by clicking on the emojis below.", color: 0xb0a8d0 },
    device: { title: "💻📱⌨️ | What device do you use?", description: "This self role will give you roles based on what device you use.", color: 0x888888 },
  };

  const meta = categoryTitles[category] ?? { title: category, description: "Click the emojis to assign yourself a role.", color: 0x7c3aed };
  const lines = roles.map(r => `${r.emoji}  **→**  ${r.label}`).join("\n");

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(meta.title)
    .setDescription(`${meta.description}\n\n${lines}`);

  if (bannerImageUrl) embed.setImage(bannerImageUrl);

  const msg = await channel.send({ embeds: [embed] });

  // Add reactions so users can click them
  for (const r of roles) {
    try { await msg.react(r.emoji); } catch {}
  }

  res.json({ messageId: msg.id });
});

export default router;
