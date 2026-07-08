import { Router, type Request, type Response } from "express";
import { getBotClient } from "../bot";

const router = Router();

const MANAGE_GUILD = BigInt(0x00000020);

/**
 * GET /api/me/guilds
 * Returns the visitor's Discord servers that also have NexusBot in them.
 * Requires a visitor session (from public OAuth flow).
 */
router.get("/me/guilds", async (req: Request, res: Response) => {
  const visitor = (req.session as any).visitor;
  if (!visitor?.accessToken) {
    res.status(401).json({ error: "Not connected" });
    return;
  }

  try {
    // Fetch visitor's full guild list from Discord
    const guildRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${visitor.accessToken}` },
    });

    if (!guildRes.ok) {
      res.status(502).json({ error: "Failed to fetch guilds from Discord" });
      return;
    }

    const userGuilds = (await guildRes.json()) as Array<{
      id: string;
      name: string;
      icon: string | null;
      permissions: string;
      owner: boolean;
    }>;

    // Cross-reference with bot's joined guilds
    const botClient = getBotClient();
    const botGuildIds = new Set(botClient?.guilds.cache.keys() ?? []);

    const matched = userGuilds
      .filter((g) => botGuildIds.has(g.id))
      .map((g) => {
        const botGuild = botClient?.guilds.cache.get(g.id);
        const perms = BigInt(g.permissions ?? "0");
        const hasManageGuild =
          g.owner || (perms & MANAGE_GUILD) === MANAGE_GUILD;

        return {
          id: g.id,
          name: g.name,
          icon: g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`
            : null,
          memberCount: botGuild?.memberCount ?? 0,
          hasManageGuild,
        };
      });

    res.json(matched);
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
