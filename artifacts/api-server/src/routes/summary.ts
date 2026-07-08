import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { moderationLogsTable, invitesTable, verificationLogsTable, analyticsEventsTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { getBotClient } from "../bot";

const router = Router({ mergeParams: true });

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get("/summary", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);

  try {
    const since30 = daysAgo(30);
    const since7 = daysAgo(7);

    // ── Joins per day (last 30 days) ────────────────────────────────────────
    const joinsRaw = await db.select({
      day: sql<string>`DATE(${invitesTable.invitedAt})`.as("day"),
      count: sql<number>`COUNT(*)::int`.as("count"),
    }).from(invitesTable)
      .where(and(eq(invitesTable.guildId, guildId), gte(invitesTable.invitedAt, since30)))
      .groupBy(sql`DATE(${invitesTable.invitedAt})`)
      .orderBy(sql`DATE(${invitesTable.invitedAt})`);

    // ── Moderation actions per day (last 30 days) ───────────────────────────
    const modRaw = await db.select({
      day: sql<string>`DATE(${moderationLogsTable.createdAt})`.as("day"),
      count: sql<number>`COUNT(*)::int`.as("count"),
      type: moderationLogsTable.type,
    }).from(moderationLogsTable)
      .where(and(eq(moderationLogsTable.guildId, guildId), gte(moderationLogsTable.createdAt, since30)))
      .groupBy(sql`DATE(${moderationLogsTable.createdAt})`, moderationLogsTable.type)
      .orderBy(sql`DATE(${moderationLogsTable.createdAt})`);

    // Collapse to day→count
    const modByDay: Record<string, number> = {};
    for (const row of modRaw) {
      modByDay[row.day] = (modByDay[row.day] ?? 0) + row.count;
    }
    const modGraph = Object.entries(modByDay).map(([day, count]) => ({ day, count }));

    // ── Verification per day (last 30 days) ─────────────────────────────────
    const verifyRaw = await db.select({
      day: sql<string>`DATE(${verificationLogsTable.createdAt})`.as("day"),
      count: sql<number>`COUNT(*)::int`.as("count"),
      status: verificationLogsTable.status,
    }).from(verificationLogsTable)
      .where(and(eq(verificationLogsTable.guildId, guildId), gte(verificationLogsTable.createdAt, since30)))
      .groupBy(sql`DATE(${verificationLogsTable.createdAt})`, verificationLogsTable.status)
      .orderBy(sql`DATE(${verificationLogsTable.createdAt})`);

    const verifyByDay: Record<string, { verified: number; failed: number }> = {};
    for (const row of verifyRaw) {
      if (!verifyByDay[row.day]) verifyByDay[row.day] = { verified: 0, failed: 0 };
      if (row.status === "verified") verifyByDay[row.day]!.verified += row.count;
      else verifyByDay[row.day]!.failed += row.count;
    }
    const verifyGraph = Object.entries(verifyByDay).map(([day, v]) => ({ day, ...v }));

    // ── Commands used per day (last 30 days) ────────────────────────────────
    const cmdRaw = await db.select({
      day: sql<string>`DATE(${analyticsEventsTable.createdAt})`.as("day"),
      count: sql<number>`COUNT(*)::int`.as("count"),
    }).from(analyticsEventsTable)
      .where(and(
        eq(analyticsEventsTable.guildId, guildId),
        eq(analyticsEventsTable.type, "command_used"),
        gte(analyticsEventsTable.createdAt, since30),
      ))
      .groupBy(sql`DATE(${analyticsEventsTable.createdAt})`)
      .orderBy(sql`DATE(${analyticsEventsTable.createdAt})`);

    // ── Totals (all time) ───────────────────────────────────────────────────
    const [totalBans] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(moderationLogsTable)
      .where(and(eq(moderationLogsTable.guildId, guildId), eq(moderationLogsTable.type, "ban")));

    const [totalKicks] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(moderationLogsTable)
      .where(and(eq(moderationLogsTable.guildId, guildId), eq(moderationLogsTable.type, "kick")));

    const [totalWarns] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(moderationLogsTable)
      .where(and(eq(moderationLogsTable.guildId, guildId), eq(moderationLogsTable.type, "warn")));

    const [totalVerified] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(verificationLogsTable)
      .where(and(eq(verificationLogsTable.guildId, guildId), eq(verificationLogsTable.status, "verified")));

    const [totalJoins7] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(invitesTable)
      .where(and(eq(invitesTable.guildId, guildId), gte(invitesTable.invitedAt, since7)));

    const [totalModActions30] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(moderationLogsTable)
      .where(and(eq(moderationLogsTable.guildId, guildId), gte(moderationLogsTable.createdAt, since30)));

    const [totalCmds30] = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(analyticsEventsTable)
      .where(and(
        eq(analyticsEventsTable.guildId, guildId),
        eq(analyticsEventsTable.type, "command_used"),
        gte(analyticsEventsTable.createdAt, since30),
      ));

    // ── Live guild info from bot ────────────────────────────────────────────
    const bot = getBotClient();
    let memberCount = 0;
    let botOnline = false;
    if (bot) {
      botOnline = true;
      const guild = bot.guilds.cache.get(guildId);
      memberCount = guild?.memberCount ?? 0;
    }

    // ── Recommendations ─────────────────────────────────────────────────────
    const recommendations: string[] = [];
    if (!botOnline) recommendations.push("Bot appears offline — check that the bot token is valid.");
    if ((totalModActions30?.count ?? 0) > 50) recommendations.push("High moderation activity this month — consider enabling AI Automod for automatic filtering.");
    if ((totalJoins7?.count ?? 0) > 20) recommendations.push("Server is growing fast! Set up a Verification System to keep out bots.");
    if ((totalVerified?.count ?? 0) === 0) recommendations.push("Verification logs are empty — consider enabling the Verification System.");

    res.json({
      graphs: {
        joins: joinsRaw,
        moderation: modGraph,
        verification: verifyGraph,
        commands: cmdRaw,
      },
      totals: {
        memberCount,
        bans: totalBans?.count ?? 0,
        kicks: totalKicks?.count ?? 0,
        warns: totalWarns?.count ?? 0,
        verifiedTotal: totalVerified?.count ?? 0,
        joinsLast7Days: totalJoins7?.count ?? 0,
        modActionsLast30Days: totalModActions30?.count ?? 0,
        commandsLast30Days: totalCmds30?.count ?? 0,
      },
      recommendations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

export default router;
