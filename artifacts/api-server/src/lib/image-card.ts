import { createCanvas, loadImage } from "@napi-rs/canvas";

// Allowlist: https URLs only, no private / link-local / loopback IP ranges
const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1|fc|fd)/i;

function validateImageUrl(raw: string): URL | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (PRIVATE_IP_RE.test(host)) return null;
  if (host === "localhost" || host === "0.0.0.0") return null;
  return url;
}

async function safeLoadImage(urlStr: string) {
  const validated = validateImageUrl(urlStr);
  if (!validated) throw new Error(`Blocked URL: ${urlStr}`);
  // Load with a timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(validated.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return loadImage(buf);
  } finally {
    clearTimeout(timer);
  }
}

export interface ImageCardOptions {
  username: string;
  avatarUrl?: string;
  serverName: string;
  memberCount: number;
  mainText: string;
  subText: string;
  bgImageUrl?: string;
  type?: "welcome" | "leave";
}

function drawGradientBg(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, W: number, H: number, type?: string) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  if (type === "leave") {
    grad.addColorStop(0, "#1a0505");
    grad.addColorStop(1, "#2d1010");
  } else {
    grad.addColorStop(0, "#0d0d1a");
    grad.addColorStop(1, "#1a0d2e");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

export async function generateImageCard(opts: ImageCardOptions): Promise<Buffer> {
  const W = 900, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. Background (image or gradient fallback)
  if (opts.bgImageUrl) {
    try {
      const bgImg = await safeLoadImage(opts.bgImageUrl);
      ctx.drawImage(bgImg, 0, 0, W, H);
    } catch {
      drawGradientBg(ctx, W, H, opts.type);
    }
  } else {
    drawGradientBg(ctx, W, H, opts.type);
  }

  // 2. Dark overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, 0, W, H);

  // 3. Left accent stripe
  const accentColor = opts.type === "leave" ? "rgba(239, 68, 68, 0.9)" : "rgba(124, 58, 237, 0.9)";
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 6, H);

  // 4. Avatar
  const avatarRadius = 65;
  const avatarCx = 120;
  const avatarCy = H / 2;

  // Glow ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarRadius + 6, 0, Math.PI * 2);
  ctx.fillStyle = opts.type === "leave" ? "rgba(239, 68, 68, 0.5)" : "rgba(124, 58, 237, 0.5)";
  ctx.fill();

  // Avatar clip
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
  ctx.clip();
  if (opts.avatarUrl) {
    try {
      const avatar = await safeLoadImage(opts.avatarUrl);
      ctx.drawImage(avatar, avatarCx - avatarRadius, avatarCy - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    } catch {
      ctx.fillStyle = "#7c3aed";
      ctx.fillRect(avatarCx - avatarRadius, avatarCy - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.fillStyle = "white";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.username.slice(0, 2).toUpperCase(), avatarCx, avatarCy);
    }
  } else {
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(avatarCx - avatarRadius, avatarCy - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.fillStyle = "white";
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.username.slice(0, 2).toUpperCase(), avatarCx, avatarCy);
  }
  ctx.restore();

  // 5. Text
  const textX = avatarCx + avatarRadius + 35;
  const maxW = W - textX - 20;

  const mainText = opts.mainText
    .replace("{user}", opts.username)
    .replace("{server}", opts.serverName)
    .replace("{count}", String(opts.memberCount));

  const subText = opts.subText
    .replace("{user}", opts.username)
    .replace("{server}", opts.serverName)
    .replace("{count}", String(opts.memberCount));

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px sans-serif";
  ctx.textBaseline = "middle";

  // Truncate to fit
  let displayMain = mainText;
  while (ctx.measureText(displayMain).width > maxW && displayMain.length > 3) {
    displayMain = displayMain.slice(0, -4) + "...";
  }
  ctx.fillText(displayMain, textX, H / 2 - 28);

  ctx.font = "26px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  let displaySub = subText;
  while (ctx.measureText(displaySub).width > maxW && displaySub.length > 3) {
    displaySub = displaySub.slice(0, -4) + "...";
  }
  ctx.fillText(displaySub, textX, H / 2 + 28);

  // 6. Footer
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "right";
  ctx.fillText(opts.serverName, W - 20, H - 18);

  return canvas.toBuffer("image/png") as unknown as Buffer;
}
