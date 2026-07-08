import type { Request, Response, NextFunction } from "express";

const IS_PROD = process.env.NODE_ENV === "production";
const DISCORD_OWNER_ID = process.env.DISCORD_OWNER_ID || "";

/**
 * Require a logged-in admin session; 401 otherwise.
 *
 * In non-production (dev/preview) environments, `/api/auth/discord` and
 * `/api/auth/me` fake a logged-in admin without ever persisting a real
 * `req.session.user`. To keep behavior consistent across all admin-only
 * routes, this middleware treats requests as authenticated in dev mode too,
 * instead of relying solely on a session value that may never get set.
 */
export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!IS_PROD) {
    if (!(req.session as any)?.user) {
      (req.session as any).user = {
        id: DISCORD_OWNER_ID || "000000000000000000",
        username: "admin",
        discriminator: "0",
        avatar: null,
        globalName: "Admin",
        accessToken: "mock_token",
      };
    }
    next();
    return;
  }

  const user = (req.session as any)?.user;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}
