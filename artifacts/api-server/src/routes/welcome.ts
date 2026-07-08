import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { welcomeConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/welcome", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(welcomeConfigTable).where(eq(welcomeConfigTable.guildId, guildId));
  if (rows.length === 0) {
    res.json({
      guildId,
      enabled: false,
      channelId: null,
      message: "Welcome to the server, {user}!",
      embedEnabled: false,
      embedColor: "#7C3AED",
      embedTitle: null,
      embedDescription: null,
      assignRoleId: null,
      imageCardEnabled: false,
      imageCardBgUrl: null,
      imageCardText: "Welcome, {user}!",
      imageCardSubtext: "Member #{count}",
    });
    return;
  }
  res.json(rows[0]);
});

router.patch("/welcome", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const body = req.body as {
    enabled?: boolean;
    channelId?: string | null;
    message?: string;
    embedEnabled?: boolean;
    embedColor?: string;
    embedTitle?: string | null;
    embedDescription?: string | null;
    assignRoleId?: string | null;
    imageCardEnabled?: boolean;
    imageCardBgUrl?: string | null;
    imageCardText?: string | null;
    imageCardSubtext?: string | null;
  };

  const existing = await db.select().from(welcomeConfigTable).where(eq(welcomeConfigTable.guildId, guildId));
  let config;
  if (existing.length === 0) {
    const [inserted] = await db.insert(welcomeConfigTable).values({
      guildId,
      message: "Welcome to the server, {user}!",
      embedColor: "#7C3AED",
      ...body,
    }).returning();
    config = inserted;
  } else {
    const [updated] = await db.update(welcomeConfigTable)
      .set(body)
      .where(eq(welcomeConfigTable.guildId, guildId))
      .returning();
    config = updated;
  }
  res.json(config);
});

// Preview image card (returns PNG)
router.get("/welcome/preview-card", async (req: Request, res: Response) => {
  const { username = "NewMember", avatarUrl = "", serverName = "Your Server", count = "1234", text, subtext, bgUrl } = req.query as Record<string, string>;
  try {
    const { generateImageCard } = await import("../lib/image-card.js");
    const buffer = await generateImageCard({
      username,
      avatarUrl: avatarUrl || undefined,
      serverName,
      memberCount: Number(count),
      mainText: text || "Welcome, {user}!",
      subText: subtext || "Member #{count}",
      bgImageUrl: bgUrl || undefined,
      type: "welcome",
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate image card. Make sure @napi-rs/canvas is installed." });
  }
});

export default router;
