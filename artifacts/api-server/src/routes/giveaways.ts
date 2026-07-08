import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { giveawaysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getBotClient } from "../bot/index";
import { EmbedBuilder } from "discord.js";
import { logger } from "../lib/logger";

const router = Router({ mergeParams: true });

router.get("/giveaways", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(giveawaysTable).where(eq(giveawaysTable.guildId, guildId));
  res.json(rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

router.post("/giveaways", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const { channelId, prize, winnerCount = 1, requiredRoleId, durationMs } = req.body as {
    channelId: string;
    prize: string;
    winnerCount?: number;
    requiredRoleId?: string | null;
    durationMs: number;
  };

  if (!channelId || !prize || !durationMs) {
    res.status(400).json({ error: "channelId, prize, and durationMs are required" });
    return;
  }

  const endsAt = new Date(Date.now() + durationMs);
  const safeWinnerCount = Math.max(1, winnerCount);
  const [giveaway] = await db.insert(giveawaysTable).values({
    guildId, channelId, prize,
    winnerCount: safeWinnerCount,
    requiredRoleId: requiredRoleId || null,
    endsAt,
  }).returning();

  // Post embed to Discord
  const client = getBotClient();
  if (client) {
    try {
      const guild = client.guilds.cache.get(guildId);
      const channel = guild?.channels.cache.get(channelId) as any;
      if (channel?.isTextBased()) {
        const endsAtMs = endsAt.getTime();
        const embed = new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle("🎉 GIVEAWAY 🎉")
          .setDescription(
            `**Prize:** ${prize}\n\n` +
            `React with 🎉 to enter!\n\n` +
            `**Winners:** ${safeWinnerCount}\n` +
            `**Ends:** <t:${Math.floor(endsAtMs / 1000)}:R>\n` +
            (requiredRoleId ? `**Required Role:** <@&${requiredRoleId}>\n` : "")
          )
          .setFooter({ text: `Giveaway ID: ${giveaway.id} • Ends at` })
          .setTimestamp(endsAt);

        const msg = await channel.send({ embeds: [embed] });
        await msg.react("🎉");
        await db.update(giveawaysTable).set({ messageId: msg.id }).where(eq(giveawaysTable.id, giveaway.id));
        giveaway.messageId = msg.id;
      }
    } catch (err) {
      logger.error({ err }, "Failed to post giveaway embed");
    }
  }

  res.status(201).json(giveaway);
});

// End giveaway early and pick winners
router.post("/giveaways/:id/end", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"]));

  const [giveaway] = await db.select().from(giveawaysTable).where(
    and(eq(giveawaysTable.id, id), eq(giveawaysTable.guildId, guildId))
  );
  if (!giveaway) { res.status(404).json({ error: "Giveaway not found" }); return; }
  if (giveaway.ended) { res.status(400).json({ error: "Giveaway already ended" }); return; }

  const winners = await pickWinners(giveaway);
  await db.update(giveawaysTable).set({ ended: true, winners }).where(eq(giveawaysTable.id, id));
  res.json({ ...giveaway, ended: true, winners });
});

// Reroll winners
router.post("/giveaways/:id/reroll", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"]));

  const [giveaway] = await db.select().from(giveawaysTable).where(
    and(eq(giveawaysTable.id, id), eq(giveawaysTable.guildId, guildId))
  );
  if (!giveaway) { res.status(404).json({ error: "Giveaway not found" }); return; }

  const winners = await pickWinners(giveaway);
  await db.update(giveawaysTable).set({ winners }).where(eq(giveawaysTable.id, id));
  res.json({ ...giveaway, winners });
});

router.delete("/giveaways/:id", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const id = parseInt(String(req.params["id"]));
  await db.delete(giveawaysTable).where(and(eq(giveawaysTable.id, id), eq(giveawaysTable.guildId, guildId)));
  res.status(204).send();
});

// ── Helper ──────────────────────────────────────────────────────────────────
async function pickWinners(giveaway: typeof giveawaysTable.$inferSelect): Promise<Array<{ userId: string; username: string }>> {
  const client = getBotClient();
  if (!client) return [];
  try {
    const guild = client.guilds.cache.get(giveaway.guildId);
    if (!guild || !giveaway.messageId) return [];
    const channel = guild.channels.cache.get(giveaway.channelId) as any;
    if (!channel?.isTextBased()) return [];

    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!message) return [];

    const reaction = message.reactions.cache.get("🎉");
    if (!reaction) return [];

    const users = await reaction.users.fetch();
    let entries = users.filter((u: any) => !u.bot).map((u: any) => ({ userId: u.id, username: u.username }));

    // Filter by required role
    if (giveaway.requiredRoleId) {
      const validEntries = [];
      for (const entry of entries) {
        const member = await guild.members.fetch(entry.userId).catch(() => null);
        if (member?.roles.cache.has(giveaway.requiredRoleId)) {
          validEntries.push(entry);
        }
      }
      entries = validEntries;
    }

    if (entries.length === 0) {
      // No valid entries — announce nobody won
      await channel.send({ content: `😢 No valid entries for the **${giveaway.prize}** giveaway.` });
      return [];
    }

    // Pick random winners
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, giveaway.winnerCount);

    // Announce
    const winnerMentions = winners.map((w: any) => `<@${w.userId}>`).join(", ");
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🎉 Giveaway Ended!")
      .setDescription(`**Prize:** ${giveaway.prize}\n\n🏆 **Winner(s):** ${winnerMentions}\n\nCongratulations!`)
      .setTimestamp();
    await channel.send({ content: winnerMentions, embeds: [embed] });

    // Edit original message
    try {
      await message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0x6b7280)
            .setTitle("🎉 GIVEAWAY ENDED 🎉")
            .setDescription(`**Prize:** ${giveaway.prize}\n\n🏆 **Winners:** ${winnerMentions}`)
            .setFooter({ text: `Giveaway ID: ${giveaway.id} • Ended` })
            .setTimestamp(),
        ],
      });
    } catch {}

    return winners;
  } catch (err) {
    logger.error({ err }, "Error picking giveaway winners");
    return [];
  }
}

export { pickWinners };
export default router;
