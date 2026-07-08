import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { rulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const PREMADE_RULES = [
  { key: "no_harassment",    label: "No harassment, bullying, or personal attacks toward other members" },
  { key: "no_nsfw",          label: "No NSFW, adult, or otherwise inappropriate content" },
  { key: "no_spam",          label: "No spam, flooding, or repeated messages in any channel" },
  { key: "no_advertising",   label: "No advertising or unsolicited self-promotion without staff permission" },
  { key: "correct_channels", label: "Use each channel for its intended purpose as described in the topic" },
  { key: "no_personal_info", label: "Do not share your own or others' personal or private information" },
  { key: "discord_tos",      label: "Follow Discord's Terms of Service and Community Guidelines at all times" },
  { key: "no_hate_speech",   label: "No hate speech, slurs, or discriminatory language of any kind" },
  { key: "respect_staff",    label: "Respect and follow instructions given by moderators and administrators" },
  { key: "no_impersonation", label: "No impersonation of staff members, bots, or other community members" },
  { key: "english_only",     label: "Use English in general channels so all members can understand" },
  { key: "no_politics",      label: "Avoid political, religious, or otherwise divisive debates in general chat" },
];

const router = Router({ mergeParams: true });

router.get("/rules", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  try {
    const rows = await db.select().from(rulesTable).where(eq(rulesTable.guildId, guildId));
    const enabledMap = new Map(rows.map(r => [r.ruleKey, r.enabled]));
    res.json(PREMADE_RULES.map(rule => ({
      key: rule.key,
      label: rule.label,
      enabled: enabledMap.get(rule.key) ?? false,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch rules" });
  }
});

router.patch("/rules", async (req: Request, res: Response) => {
  const guildId = String(req.params["guildId"]);
  const updates = req.body;

  if (!Array.isArray(updates)) {
    res.status(400).json({ error: "Expected array of rule updates" });
    return;
  }

  // Validate every item before touching the DB
  for (const item of updates) {
    if (typeof item !== "object" || item === null
      || typeof item.key !== "string"
      || typeof item.enabled !== "boolean") {
      res.status(400).json({ error: "Each rule update must have string key and boolean enabled" });
      return;
    }
  }

  const typedUpdates = updates as Array<{ key: string; enabled: boolean }>;

  try {
    for (const update of typedUpdates) {
      if (!PREMADE_RULES.find(r => r.key === update.key)) continue;
      await db.insert(rulesTable).values({
        guildId,
        ruleKey: update.key,
        enabled: update.enabled,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [rulesTable.guildId, rulesTable.ruleKey],
        set: { enabled: update.enabled, updatedAt: new Date() },
      } as any);
    }

    const rows = await db.select().from(rulesTable).where(eq(rulesTable.guildId, guildId));
    const enabledMap = new Map(rows.map(r => [r.ruleKey, r.enabled]));
    res.json(PREMADE_RULES.map(rule => ({
      key: rule.key,
      label: rule.label,
      enabled: enabledMap.get(rule.key) ?? false,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update rules" });
  }
});

export default router;
