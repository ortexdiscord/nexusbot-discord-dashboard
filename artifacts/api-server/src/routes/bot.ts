import { Router, type Request, type Response } from "express";
import { getBotClient } from "../bot";

const router = Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1521402625420034058";
const PERMISSIONS = "8"; // Administrator
const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${PERMISSIONS}&scope=bot+applications.commands`;

router.get("/bot", (_req: Request, res: Response) => {
  const client = getBotClient();

  if (!client?.user) {
    res.json({
      id: CLIENT_ID,
      username: "Umbra Utilities",
      tag: "Umbra Utilities",
      avatar: null,
      guildCount: 0,
      inviteUrl: INVITE_URL,
      guilds: [],
    });
    return;
  }

  const guilds = client.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.icon
      ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
      : null,
    memberCount: g.memberCount,
  }));

  const avatarUrl = client.user.avatar
    ? `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(client.user.discriminator || "0") % 5}.png`;

  res.json({
    id: client.user.id,
    username: client.user.username,
    tag: client.user.tag,
    avatar: avatarUrl,
    guildCount: guilds.length,
    inviteUrl: INVITE_URL,
    guilds,
  });
});

export default router;
