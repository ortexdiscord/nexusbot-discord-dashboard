import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const DISCORD_OWNER_ID = process.env.DISCORD_OWNER_ID || "";
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "";
const IS_PROD = process.env.NODE_ENV === "production";

function getCallbackUri(req: Request, suffix: string): string {
  // In production, use the explicit env var if set
  if (IS_PROD && DISCORD_REDIRECT_URI) {
    // DISCORD_REDIRECT_URI is the base domain — append the specific callback path
    const base = DISCORD_REDIRECT_URI.replace(/\/api\/auth.*$/, "");
    return `${base}/api/auth${suffix}`;
  }
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    req.get("host") ||
    "localhost";
  return `${proto}://${host}/api/auth${suffix}`;
}

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      discriminator: string;
      avatar: string | null;
      globalName: string | null;
      accessToken: string;
    };
    visitor?: {
      id: string;
      username: string;
      avatar: string | null;
      globalName: string | null;
      accessToken: string;
    };
  }
}

// ── Admin auth ───────────────────────────────────────────────────────────────

router.get("/discord", (req: Request, res: Response) => {
  if (!IS_PROD) {
    // Dev/preview — mock login, no real OAuth needed
    (req.session as any).user = {
      id: DISCORD_OWNER_ID || "000000000000000000",
      username: "admin",
      discriminator: "0",
      avatar: null,
      globalName: "Admin",
      accessToken: "mock_token",
    };
    req.session.save(() => res.redirect("/"));
    return;
  }

  const redirectUri = getCallbackUri(req, "/discord/callback");
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

router.get("/discord/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) { res.redirect("/"); return; }

  try {
    const redirectUri = getCallbackUri(req, "/discord/callback");
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (!tokenData.access_token) { res.redirect("/"); return; }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = (await userRes.json()) as any;

    // ── Owner-only gate ──────────────────────────────────────────────────────
    if (DISCORD_OWNER_ID && userData.id !== DISCORD_OWNER_ID) {
      logger.warn({ userId: userData.id }, "Unauthorized login attempt blocked");
      res.status(403).send(`
        <html><body style="background:#1a0838;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px">
          <div style="font-size:2rem">🔒</div>
          <h2 style="margin:0">Access Denied</h2>
          <p style="color:#a78bfa;margin:0">This dashboard is private.</p>
          <a href="/" style="color:#f5c400;margin-top:8px">Go back</a>
        </body></html>
      `);
      return;
    }

    (req.session as any).user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      globalName: userData.global_name,
      accessToken: tokenData.access_token,
    };

    req.session.save(() => res.redirect("/"));
  } catch (err) {
    logger.error({ err }, "Discord OAuth callback error");
    res.redirect("/");
  }
});

router.get("/me", (req: Request, res: Response) => {
  if (!IS_PROD) {
    // Dev bypass — always return mock admin
    const user = (req.session as any).user ?? {
      id: DISCORD_OWNER_ID || "000000000000000000",
      username: "admin",
      discriminator: "0",
      avatar: null,
      globalName: "Admin",
    };
    const { accessToken: _t, ...pub } = user as any;
    res.json(pub);
    return;
  }

  // Production — require real session + owner check
  const user = (req.session as any).user;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (DISCORD_OWNER_ID && user.id !== DISCORD_OWNER_ID) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { accessToken: _t, ...pub } = user as any;
  res.json(pub);
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── Public / visitor auth ────────────────────────────────────────────────────

router.get("/public", (req: Request, res: Response) => {
  if (!IS_PROD) {
    (req.session as any).visitor = {
      id: "visitor-demo",
      username: "DemoVisitor",
      avatar: null,
      globalName: "Demo Visitor",
      accessToken: "mock_visitor_token",
    };
    req.session.save(() => res.redirect("/bot"));
    return;
  }

  const redirectUri = getCallbackUri(req, "/public/callback");
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

router.get("/public/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) { res.redirect("/bot"); return; }

  try {
    const redirectUri = getCallbackUri(req, "/public/callback");
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (!tokenData.access_token) { res.redirect("/bot"); return; }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = (await userRes.json()) as any;

    (req.session as any).visitor = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar,
      globalName: userData.global_name,
      accessToken: tokenData.access_token,
    };
    req.session.cookie.maxAge = 60 * 60 * 1000;
    req.session.save(() => res.redirect("/bot"));
  } catch (err) {
    logger.error({ err }, "Public OAuth callback error");
    res.redirect("/bot");
  }
});

router.get("/visitor", (req: Request, res: Response) => {
  const visitor = (req.session as any).visitor;
  if (!visitor) { res.status(401).json({ error: "Not connected" }); return; }
  const { accessToken: _t, ...pub } = visitor;
  res.json(pub);
});

router.post("/visitor/logout", (req: Request, res: Response) => {
  (req.session as any).visitor = undefined;
  req.session.save(() => res.json({ ok: true }));
});

export default router;
