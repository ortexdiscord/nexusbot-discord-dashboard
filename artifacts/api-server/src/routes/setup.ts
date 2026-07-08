import { Router, type Request, type Response } from "express";
import { getBotClient } from "../bot";
import { ChannelType } from "discord.js";
import { requireSession } from "../lib/require-session";

const router = Router({ mergeParams: true });

/**
 * GET /guilds/:guildId/members?q=...
 * Search guild members by username prefix. Returns up to 25 results.
 */
router.get("/members", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const query = String(req.query["q"] ?? "").trim();

  const client = getBotClient();
  if (!client) { res.json([]); return; }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) { res.json([]); return; }

  try {
    const memberCollection = query.length >= 2
      ? await guild.members.search({ query, limit: 25 })
      : guild.members.cache;

    const result = [...memberCollection.values()].slice(0, 30).map(m => ({
      id: m.id,
      username: m.user.username,
      globalName: m.user.globalName ?? null,
      displayName: m.displayName,
      avatar: m.user.avatar,
    }));
    res.json(result);
  } catch {
    res.json([]);
  }
});

/**
 * POST /guilds/:guildId/setup
 * Body: { createChannels, createRoles, createCommunityChannels, createExtraRoles }
 */
router.post("/setup", requireSession, async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const {
    createChannels = false,
    createRoles = false,
    createCommunityChannels = false,
    createExtraRoles = false,
  } = (req.body ?? {}) as {
    createChannels?: boolean;
    createRoles?: boolean;
    createCommunityChannels?: boolean;
    createExtraRoles?: boolean;
  };

  const client = getBotClient();
  if (!client) {
    res.status(400).json({ error: "Bot is not connected" });
    return;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    res.status(404).json({ error: "Bot is not in this server" });
    return;
  }

  const created: { channels: string[]; roles: string[]; errors: string[] } = {
    channels: [],
    roles: [],
    errors: [],
  };

  // ── Bot Channels ────────────────────────────────────────────────────────────
  if (createChannels) {
    try {
      const category = await guild.channels.create({
        name: "Umbra Utilities",
        type: ChannelType.GuildCategory,
        reason: "Auto-created by Umbra Utilities setup",
      });
      created.channels.push(`📁 ${category.name}`);

      for (const chName of ["bot-logs", "mod-logs", "join-logs"]) {
        const ch = await guild.channels.create({
          name: chName,
          type: ChannelType.GuildText,
          parent: category.id,
          reason: "Auto-created by Umbra Utilities setup",
        });
        created.channels.push(`#${ch.name}`);
      }
    } catch (err: unknown) {
      created.errors.push(`Bot Channels: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // ── Community Channels ──────────────────────────────────────────────────────
  if (createCommunityChannels) {
    try {
      const communityCategory = await guild.channels.create({
        name: "Community",
        type: ChannelType.GuildCategory,
        reason: "Auto-created by Umbra Utilities setup",
      });
      created.channels.push(`📁 ${communityCategory.name}`);

      for (const chName of ["welcome", "goodbye", "rules"]) {
        const ch = await guild.channels.create({
          name: chName,
          type: ChannelType.GuildText,
          parent: communityCategory.id,
          reason: "Auto-created by Umbra Utilities setup",
        });
        created.channels.push(`#${ch.name}`);
      }
    } catch (err: unknown) {
      created.errors.push(`Community Channels: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // ── Moderation Roles ────────────────────────────────────────────────────────
  if (createRoles) {
    try {
      const managerRole = await guild.roles.create({
        name: "Bot Manager",
        color: 0xf5c400,
        reason: "Auto-created by Umbra Utilities setup",
      });
      created.roles.push(managerRole.name);

      const mutedRole = await guild.roles.create({
        name: "Muted",
        color: 0x2c2f33,
        permissions: [],
        reason: "Auto-created by Umbra Utilities setup",
      });
      created.roles.push(mutedRole.name);
    } catch (err: unknown) {
      created.errors.push(`Mod Roles: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // ── Extra Roles ─────────────────────────────────────────────────────────────
  if (createExtraRoles) {
    const extraRoleDefs = [
      { name: "Verified",  color: 0x57f287 },  // green
      { name: "Member",    color: 0x5865f2 },  // blurple
      { name: "VIP",       color: 0xfee75c },  // yellow
    ];
    for (const def of extraRoleDefs) {
      try {
        const role = await guild.roles.create({
          name: def.name,
          color: def.color,
          reason: "Auto-created by Umbra Utilities setup",
        });
        created.roles.push(role.name);
      } catch (err: unknown) {
        created.errors.push(`${def.name} role: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }

  res.json(created);
});

export default router;
