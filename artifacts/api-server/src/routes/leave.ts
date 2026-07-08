import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { leaveConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/leave", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const rows = await db.select().from(leaveConfigTable).where(eq(leaveConfigTable.guildId, guildId));
  if (rows.length === 0) {
    res.json({
      guildId,
      enabled: false,
      channelId: null,
      message: "Goodbye, {user}! We hope to see you again.",
      embedEnabled: false,
      embedColor: "#7C3AED",
      embedTitle: null,
      embedDescription: null,
      imageCardEnabled: false,
      imageCardBgUrl: null,
      imageCardText: "Goodbye, {user}!",
      imageCardSubtext: "We now have {count} members",
    });
    return;
  }
  res.json(rows[0]);
});

router.patch("/leave", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const body = req.body as {
    enabled?: boolean;
    channelId?: string | null;
    message?: string;
    embedEnabled?: boolean;
    embedColor?: string;
    embedTitle?: string | null;
    embedDescription?: string | null;
    imageCardEnabled?: boolean;
    imageCardBgUrl?: string | null;
    imageCardText?: string | null;
    imageCardSubtext?: string | null;
  };

  const existing = await db.select().from(leaveConfigTable).where(eq(leaveConfigTable.guildId, guildId));
  let config;
  if (existing.length === 0) {
    const [inserted] = await db.insert(leaveConfigTable).values({
      guildId,
      message: "Goodbye, {user}! We hope to see you again.",
      embedColor: "#7C3AED",
      ...body,
    }).returning();
    config = inserted;
  } else {
    const [updated] = await db.update(leaveConfigTable)
      .set(body)
      .where(eq(leaveConfigTable.guildId, guildId))
      .returning();
    config = updated;
  }
  res.json(config);
});

// Preview image card (returns PNG)
router.get("/leave/preview-card", async (req: Request, res: Response) => {
  const { username = "LeavingMember", avatarUrl = "", serverName = "Your Server", count = "1234", text, subtext, bgUrl } = req.query as Record<string, string>;
  try {
    const { generateImageCard } = await import("../lib/image-card.js");
    const buffer = await generateImageCard({
      username,
      avatarUrl: avatarUrl || undefined,
      serverName,
      memberCount: Number(count),
      mainText: text || "Goodbye, {user}!",
      subText: subtext || "We now have {count} members",
      bgImageUrl: bgUrl || undefined,
      type: "leave",
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate image card. Make sure @napi-rs/canvas is installed." });
  }
});

export default router;
