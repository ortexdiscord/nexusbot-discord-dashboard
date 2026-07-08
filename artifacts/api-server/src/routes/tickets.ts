import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { ticketSettingsTable, openTicketsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getBotClient } from "../bot/index";
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } from "discord.js";

const router = Router({ mergeParams: true });

router.get("/tickets/settings", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const [row] = await db.select().from(ticketSettingsTable).where(eq(ticketSettingsTable.guildId, guildId));
  res.json(row ?? null);
});

router.put("/tickets/settings", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const body = req.body as Partial<typeof ticketSettingsTable.$inferInsert>;
  const existing = await db.select().from(ticketSettingsTable).where(eq(ticketSettingsTable.guildId, guildId));

  if (existing.length) {
    const [updated] = await db.update(ticketSettingsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(ticketSettingsTable.guildId, guildId))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(ticketSettingsTable).values({ guildId, ...body }).returning();
    res.json(created);
  }
});

router.get("/tickets/open", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const tickets = await db.select().from(openTicketsTable).where(eq(openTicketsTable.guildId, guildId));
  res.json(tickets);
});

router.post("/tickets/send-panel", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const client = getBotClient();
  if (!client) { res.status(503).json({ error: "Bot not connected" }); return; }

  const [settings] = await db.select().from(ticketSettingsTable).where(eq(ticketSettingsTable.guildId, guildId));
  if (!settings?.panelChannelId) { res.status(400).json({ error: "Panel channel not configured" }); return; }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Guild not found" }); return; }

  const channel = guild.channels.cache.get(settings.panelChannelId) as any;
  if (!channel?.isTextBased()) { res.status(404).json({ error: "Channel not found" }); return; }

  const color = parseInt((settings.panelColor || "#7C3AED").replace("#", ""), 16);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(settings.panelTitle)
    .setDescription(settings.panelDescription);

  const button = new ButtonBuilder()
    .setCustomId(`ticket_open_${guildId}`)
    .setLabel("🎫 Open Ticket")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  const msg = await channel.send({ embeds: [embed], components: [row] });

  await db.update(ticketSettingsTable)
    .set({ panelMessageId: msg.id, updatedAt: new Date() })
    .where(eq(ticketSettingsTable.guildId, guildId));

  res.json({ messageId: msg.id });
});

router.patch("/tickets/open/:ticketId/close", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const ticketId = parseInt(String(req.params["ticketId"]));

  const [ticket] = await db.select().from(openTicketsTable)
    .where(and(eq(openTicketsTable.id, ticketId), eq(openTicketsTable.guildId, guildId)));

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const client = getBotClient();
  if (client) {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(ticket.channelId) as any;
    if (channel) {
      await channel.send("🔒 This ticket has been closed by an admin.").catch(() => {});
      setTimeout(() => channel.delete().catch(() => {}), 5000);
    }
  }

  await db.update(openTicketsTable)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(openTicketsTable.id, ticketId));

  res.json({ success: true });
});

export default router;
