import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { webhookLogsTable, webhookConfigsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getBotClient } from "../bot/index";
import {
  EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { discoButtonResponses } from "../bot/disco-buttons";
import { requireSession } from "../lib/require-session";

const router = Router({ mergeParams: true });

// --- Logs ---
router.get("/webhook-sender", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const logs = await db.select().from(webhookLogsTable)
    .where(eq(webhookLogsTable.guildId, guildId))
    .orderBy(desc(webhookLogsTable.sentAt))
    .limit(50);
  res.json(logs.map(l => ({ ...l, sentAt: l.sentAt.toISOString() })));
});

// --- Send message ---
router.post("/webhook-sender/send", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const body = req.body as {
    channelId?: string;
    message?: string;
    embedEnabled?: boolean;
    embedColor?: string;
    embedTitle?: string | null;
    embedDescription?: string | null;
    imageUrl?: string | null;
    extraEmbeds?: Array<{ color: string; title: string; description: string; imageUrl: string }>;
    buttons?: Array<{ customId: string; label: string; style: string; response: string }>;
    sendAs?: "bot" | "webhook";
    webhookId?: number;
  };

  const client = getBotClient();
  if (!client) { res.status(503).json({ error: "Bot not connected" }); return; }

  // ── Server-side validation ────────────────────────────────────────────────
  const extraEmbeds = body.extraEmbeds ?? [];
  const buttonDefs = body.buttons ?? [];
  const totalEmbeds = (body.embedEnabled ? 1 : 0) + extraEmbeds.length;

  if (totalEmbeds > 10) {
    res.status(400).json({ error: "Maximum 10 embeds per message" }); return;
  }
  if (buttonDefs.length > 5) {
    res.status(400).json({ error: "Maximum 5 buttons per message" }); return;
  }

  // Enforce disco_btn_ namespace — reject any button with a foreign customId prefix
  for (const btn of buttonDefs) {
    if (!btn.customId.startsWith("disco_btn_")) {
      res.status(400).json({ error: "Invalid button customId — must start with disco_btn_" }); return;
    }
    // Cap label and response lengths to Discord limits
    btn.label = (btn.label || "Click").slice(0, 80);
    btn.response = (btn.response || "✅").slice(0, 2000);
  }

  // ── Build embeds ──────────────────────────────────────────────────────────
  const embedBuilders: EmbedBuilder[] = [];

  if (body.embedEnabled) {
    const embed = new EmbedBuilder()
      .setColor(parseInt((body.embedColor || "#7C3AED").replace("#", ""), 16))
      .setDescription(body.embedDescription || body.message || "\u200b");
    if (body.embedTitle) embed.setTitle(body.embedTitle.slice(0, 256));
    if (body.imageUrl) embed.setImage(body.imageUrl);
    embedBuilders.push(embed);
  }

  for (const ex of extraEmbeds) {
    const embed = new EmbedBuilder()
      .setColor(parseInt((ex.color || "#5865F2").replace("#", ""), 16))
      .setDescription((ex.description || "\u200b").slice(0, 4096));
    if (ex.title) embed.setTitle(ex.title.slice(0, 256));
    if (ex.imageUrl) embed.setImage(ex.imageUrl);
    embedBuilders.push(embed);
  }

  // ── Build button row ──────────────────────────────────────────────────────
  const ALLOWED_STYLES: Record<string, ButtonStyle> = {
    primary:   ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    danger:    ButtonStyle.Danger,
  };

  let components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (buttonDefs.length > 0) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const btn of buttonDefs) {
      const button = new ButtonBuilder()
        .setCustomId(btn.customId)
        .setLabel(btn.label)
        .setStyle(ALLOWED_STYLES[btn.style] ?? ButtonStyle.Primary);
      row.addComponents(button);
      // Store ephemeral response (keyed by customId)
      discoButtonResponses.set(btn.customId, btn.response);
    }
    components = [row];
  }

  // ── Resolve effective channelId for logging ───────────────────────────────
  let logChannelId = body.channelId || "";

  // ── Send ──────────────────────────────────────────────────────────────────
  try {
    if (body.sendAs === "webhook" && body.webhookId) {
      const [wh] = await db.select().from(webhookConfigsTable)
        .where(and(eq(webhookConfigsTable.id, body.webhookId), eq(webhookConfigsTable.guildId, guildId)));
      if (!wh) { res.status(404).json({ error: "Webhook not found" }); return; }

      logChannelId = wh.channelId; // use the webhook's associated channelId for the log

      const discordWh = await client.fetchWebhook(wh.webhookId, wh.webhookToken);
      await discordWh.send({
        content: body.message || undefined,
        embeds: embedBuilders,
        components,
      });
    } else {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) { res.status(404).json({ error: "Guild not found" }); return; }
      const channel = guild.channels.cache.get(body.channelId || "") as any;
      if (!channel?.isTextBased()) { res.status(404).json({ error: "Channel not found" }); return; }

      if (embedBuilders.length > 0 || components.length > 0) {
        await channel.send({
          content: body.message || undefined,
          embeds: embedBuilders,
          components,
        });
      } else {
        await channel.send(body.message || "");
      }
    }

    const [log] = await db.insert(webhookLogsTable).values({
      guildId,
      channelId: logChannelId,
      message: body.message || body.embedDescription || "",
      embedEnabled: body.embedEnabled || false,
      embedColor: body.embedColor || "#7C3AED",
      embedTitle: body.embedTitle || null,
      embedDescription: body.embedDescription || null,
      imageUrl: body.imageUrl || null,
      sentByUserId: (req as any).session?.user?.id ?? null,
      sentByUsername: (req as any).session?.user?.username ?? null,
    }).returning();

    res.json({ ...log, sentAt: log.sentAt.toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send message" });
  }
});

// --- Webhook CRUD ---
router.get("/webhooks", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(webhookConfigsTable).where(eq(webhookConfigsTable.guildId, guildId));
  res.json(rows.map(r => ({ ...r, webhookToken: "***" })));
});

router.post("/webhooks", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const { channelId, name, avatarUrl } = req.body as { channelId: string; name?: string; avatarUrl?: string };
  if (!channelId) { res.status(400).json({ error: "channelId is required" }); return; }

  const client = getBotClient();
  if (!client) { res.status(503).json({ error: "Bot not connected" }); return; }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Guild not found" }); return; }

  const channel = guild.channels.cache.get(channelId) as any;
  if (!channel?.isTextBased()) { res.status(404).json({ error: "Channel not found" }); return; }

  const botMember = guild.members.me ?? await guild.members.fetchMe();
  const myPerms = channel.permissionsFor(botMember);
  if (!myPerms?.has(PermissionFlagsBits.ManageWebhooks)) {
    res.status(403).json({ error: "Bot is missing the Manage Webhooks permission in this channel. Grant it in Discord → Server Settings → Roles." });
    return;
  }

  try {
    const wh = await channel.createWebhook({
      name: name || "Umbra Utilities",
      avatar: avatarUrl || undefined,
      reason: "Created via Umbra Utilities dashboard",
    });

    const [created] = await db.insert(webhookConfigsTable).values({
      guildId,
      channelId,
      webhookId: wh.id,
      webhookToken: wh.token!,
      name: name || "Umbra Utilities",
      avatarUrl: avatarUrl || null,
    }).returning();

    res.status(201).json({ ...created, webhookToken: "***", webhookUrl: `https://discord.com/api/webhooks/${wh.id}/${wh.token}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create webhook" });
  }
});

router.delete("/webhooks/:id", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"]));

  const [wh] = await db.select().from(webhookConfigsTable)
    .where(and(eq(webhookConfigsTable.id, id), eq(webhookConfigsTable.guildId, guildId)));
  if (!wh) { res.status(404).json({ error: "Not found" }); return; }

  const client = getBotClient();
  if (client) {
    try {
      const discordWh = await client.fetchWebhook(wh.webhookId, wh.webhookToken);
      await discordWh.delete("Removed via Umbra Utilities dashboard").catch(() => {});
    } catch {}
  }

  await db.delete(webhookConfigsTable).where(eq(webhookConfigsTable.id, id));
  res.status(204).send();
});

// Send message via stored webhook (custom name/avatar)
router.post("/webhooks/:id/send", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"]));
  const { content, username, avatarUrl } = req.body as { content: string; username?: string; avatarUrl?: string };

  const [wh] = await db.select().from(webhookConfigsTable)
    .where(and(eq(webhookConfigsTable.id, id), eq(webhookConfigsTable.guildId, guildId)));
  if (!wh) { res.status(404).json({ error: "Not found" }); return; }

  const client = getBotClient();
  if (!client) { res.status(503).json({ error: "Bot not connected" }); return; }

  try {
    const discordWh = await client.fetchWebhook(wh.webhookId, wh.webhookToken);
    await discordWh.send({ content, username: username || wh.name, avatarURL: avatarUrl || wh.avatarUrl || undefined });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send" });
  }
});

export default router;
