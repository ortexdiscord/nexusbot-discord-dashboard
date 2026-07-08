import { Router, type Request, type Response } from "express";
import { getBotClient, getBotUptime } from "../bot/index";
import { slashCommands } from "../bot/commands";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const client = getBotClient();

  const totalGuilds = client?.guilds.cache.size ?? 0;
  const totalUsers = client?.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0) ?? 0;
  const ping = client ? Math.max(0, Math.round(client.ws.ping)) : 0;
  const uptimeMs = getBotUptime();
  const uptime = uptimeMs ? Math.floor(uptimeMs / 1000) : 0;

  res.json({
    totalGuilds,
    totalUsers,
    totalCommands: slashCommands.length,
    uptime,
    ping,
    online: !!client?.user,
  });
});

export default router;
