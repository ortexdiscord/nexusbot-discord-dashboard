import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { applicationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getBotClient } from "../bot/index";
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

const router = Router({ mergeParams: true });

router.get("/applications", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const apps = await db.select().from(applicationsTable).where(eq(applicationsTable.guildId, guildId));
  res.json(apps);
});

router.post("/applications", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const { title, description, questions, responseChannelId, color } = req.body;
  if (!title) { res.status(400).json({ error: "Title is required" }); return; }

  const [created] = await db.insert(applicationsTable).values({
    guildId, title,
    description: description ?? "",
    questions: questions ?? [],
    responseChannelId: responseChannelId ?? null,
    color: color ?? "#7C3AED",
  }).returning();
  res.status(201).json(created);
});

router.patch("/applications/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"]));
  const body = req.body;

  const [updated] = await db.update(applicationsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(applicationsTable.id, id), eq(applicationsTable.guildId, guildId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/applications/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"]));
  await db.delete(applicationsTable).where(and(eq(applicationsTable.id, id), eq(applicationsTable.guildId, guildId)));
  res.status(204).send();
});

router.post("/applications/:id/send-panel", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"]));
  const { channelId } = req.body as { channelId: string };

  const [app] = await db.select().from(applicationsTable)
    .where(and(eq(applicationsTable.id, id), eq(applicationsTable.guildId, guildId)));
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }

  const client = getBotClient();
  if (!client) { res.status(503).json({ error: "Bot not connected" }); return; }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Guild not found" }); return; }

  const targetChannelId = channelId || app.panelChannelId;
  if (!targetChannelId) { res.status(400).json({ error: "Channel not specified" }); return; }

  const channel = guild.channels.cache.get(targetChannelId) as any;
  if (!channel?.isTextBased()) { res.status(404).json({ error: "Channel not found" }); return; }

  const color = parseInt((app.color || "#7C3AED").replace("#", ""), 16);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📋 ${app.title}`)
    .setDescription(app.description || "Click the button below to apply!");

  const qs = app.questions as any[];
  if (qs?.length) {
    embed.addFields({ name: "Questions", value: qs.map((q: any, i: number) => `${i + 1}. ${q.question}`).join("\n") });
  }

  const button = new ButtonBuilder()
    .setCustomId(`app_apply_${guildId}_${id}`)
    .setLabel("📝 Apply Now")
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  const msg = await channel.send({ embeds: [embed], components: [row] });

  await db.update(applicationsTable)
    .set({ panelChannelId: targetChannelId, panelMessageId: msg.id, updatedAt: new Date() })
    .where(eq(applicationsTable.id, id));

  res.json({ messageId: msg.id });
});

export default router;
