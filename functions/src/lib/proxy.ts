import type { RequestHandler } from "express";
import { config } from "../config";
import { safeEqual } from "./crypto";
import { HttpError } from "./errors";

export const PROXY_HEADER = "x-latox-proxy";
export const SSR_HEADER = "x-latox-ssr";

/**
 * Front-door guard for deployments where the website (Vercel) proxies /api to this
 * function. When API_PROXY_SECRET is set:
 *  - requests must carry the shared secret header, so the function cannot be called
 *    directly to bypass the website's origin (and its anti-spoofing of client IPs);
 *  - the client IP comes from `x-real-ip`, which Vercel overwrites with the real
 *    visitor address (clients cannot forge it through Vercel).
 * Without a secret (emulator/tests), Express's trust-proxy setting decides req.ip.
 */
export const trustedProxy: RequestHandler = (req, _res, next) => {
  const secret = config.proxySecret;
  if (!secret) {
    req.clientIp = req.ip;
    return next();
  }
  const provided = req.get(PROXY_HEADER) ?? "";
  if (!provided || !safeEqual(provided, secret)) {
    if (req.path.endsWith("/health")) {
      req.clientIp = req.ip;
      return next();
    }
    return next(new HttpError(403, "DIRECT_ACCESS_DENIED", "Acesso direto não permitido."));
  }
  const realIp = (req.get("x-real-ip") ?? req.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  req.clientIp = realIp || req.ip;
  // Server-side rendering calls from the website share a few egress IPs; they are
  // authenticated by the secret, read-only and cached, so they skip per-IP limits.
  req.fromSsr = req.get(SSR_HEADER) === "1" && req.method === "GET" && req.path.startsWith("/api/v1/public/");
  next();
};
