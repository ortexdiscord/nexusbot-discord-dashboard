import { Message } from "discord.js";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { automodEventsTable } from "@workspace/db";

const OPENROUTER_KEY = process.env["OpenrouterAi"];
const GEMINI_KEY = process.env["GEMINI_API_KEY"];

interface AiVerdict {
  flagged: boolean;
  reason?: string;
  score?: number; // 0–1
}

async function callGemini(content: string, sensitivity: string): Promise<AiVerdict> {
  if (!GEMINI_KEY) throw new Error("No GEMINI_API_KEY");
  const thresh = sensitivity === "high" ? 0.3 : sensitivity === "low" ? 0.7 : 0.5;
  const prompt = `You are a Discord content moderator. Evaluate this message for harmful content (hate speech, severe toxicity, harassment, threats, NSFW, spam). Respond with JSON only: {"flagged": boolean, "reason": string, "score": number (0-1 where 1 = most harmful)}. Message: "${content.replace(/"/g, "'").slice(0, 500)}"`;
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini error ${resp.status}`);
  const data = await resp.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text) as AiVerdict & { score: number };
  return { flagged: parsed.flagged && (parsed.score ?? 0) >= thresh, reason: parsed.reason, score: parsed.score };
}

async function callOpenRouter(content: string, sensitivity: string): Promise<AiVerdict> {
  if (!OPENROUTER_KEY) throw new Error("No OPENROUTER_API_KEY");
  const thresh = sensitivity === "high" ? 0.3 : sensitivity === "low" ? 0.7 : 0.5;
  const prompt = `You are a Discord content moderator. Evaluate this message for harmful content. Respond with JSON only: {"flagged": boolean, "reason": string, "score": number}. Message: "${content.replace(/"/g, "'").slice(0, 500)}"`;
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-flash-1.5",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`OpenRouter error ${resp.status}`);
  const data = await resp.json() as any;
  const text = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as AiVerdict & { score: number };
  return { flagged: parsed.flagged && (parsed.score ?? 0) >= thresh, reason: parsed.reason, score: parsed.score };
}

/** Returns true if message was actioned (deleted/etc). */
export async function runAiAutomod(
  message: Message,
  sensitivity: string,
  action: string,
  logChannelId?: string | null,
): Promise<boolean> {
  if (!message.content.trim()) return false;

  let verdict: AiVerdict;
  try {
    // Prefer Gemini; fall back to OpenRouter
    if (GEMINI_KEY) {
      verdict = await callGemini(message.content, sensitivity);
    } else if (OPENROUTER_KEY) {
      verdict = await callOpenRouter(message.content, sensitivity);
    } else {
      logger.warn("AI Automod enabled but no API key found (GEMINI_API_KEY or OPENROUTER_API_KEY)");
      return false;
    }
  } catch (err) {
    logger.error({ err }, "AI Automod API error");
    return false;
  }

  if (!verdict.flagged) return false;

  logger.info({ userId: message.author.id, score: verdict.score, reason: verdict.reason }, "AI Automod flagged message");

  // Persist event to DB for dashboard log
  try {
    await db.insert(automodEventsTable).values({
      guildId: message.guild!.id,
      userId: message.author.id,
      username: message.author.username,
      channelId: message.channelId,
      content: message.content.slice(0, 500),
      reason: verdict.reason ?? null,
      score: verdict.score ?? null,
      action,
    });
  } catch (err) { logger.error({ err }, "Failed to persist automod event"); }

  try {
    // Always delete the message
    await message.delete().catch(() => {});

    if (action === "warn" || action === "mute") {
      await message.author.send(
        `⚠️ Your message in **${message.guild?.name}** was removed by AI Automod.\nReason: ${verdict.reason ?? "Potentially harmful content"}`
      ).catch(() => {});
    }

    // Log to channel if configured
    if (logChannelId && message.guild) {
      const logCh = message.guild.channels.cache.get(logChannelId) as any;
      if (logCh?.isTextBased()) {
        const { EmbedBuilder } = await import("discord.js");
        const embed = new EmbedBuilder()
          .setColor(0xe11d48)
          .setTitle("🤖 AI Automod — Message Removed")
          .addFields(
            { name: "User", value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
            { name: "Channel", value: `<#${message.channelId}>`, inline: true },
            { name: "Score", value: `${((verdict.score ?? 0) * 100).toFixed(0)}%`, inline: true },
            { name: "Reason", value: verdict.reason ?? "Flagged content", inline: false },
            { name: "Content", value: message.content.slice(0, 500) || "*(empty)*", inline: false },
          )
          .setTimestamp();
        await logCh.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, "AI Automod action error");
  }

  return true;
}
