import type { RequestHandler } from "express";
import { config } from "../config";
import { safeEqual } from "./crypto";
import { HttpError } from "./errors";

export const PROXY_HEADER = "x-latox-proxy";
export const SSR_HEADER = "x-latox-ssr";
export const CLIENT_IP_HEADER = "x-latox-client-ip";

/** Paths reachable without the proxy secret (they have their own protection). */
const OPEN_PATHS = [/\/api\/v1\/health$/, /\/api\/v1\/internal\/cleanup$/];

/**
 * Front-door guard. The website (Vercel) proxies /api to this API with a shared secret.
 * When API_PROXY_SECRET is set:
 *  - requests without the secret are rejected, so the API cannot be called directly
 *    around the website;
 *  - the visitor IP comes from `x-latox-client-ip`, which the website's middleware fills
 *    from the platform-provided `x-real-ip` (visitors cannot forge it through the site).
 * Without a secret (local development/tests), Express's trust-proxy setting decides req.ip.
 */
export const trustedProxy: RequestHandler = (req, _res, next) => {
  const secret = config.proxySecret;
  if (!secret) {
    req.clientIp = req.ip;
    return next();
  }
  const provided = req.get(PROXY_HEADER) ?? "";
  if (!provided || !safeEqual(provided, secret)) {
    if (OPEN_PATHS.some((re) => re.test(req.path))) {
      req.clientIp = req.ip;
      return next();
    }
    return next(new HttpError(403, "DIRECT_ACCESS_DENIED", "Acesso direto não permitido."));
  }
  const ip = (req.get(CLIENT_IP_HEADER) ?? req.get("x-real-ip") ?? "").trim();
  req.clientIp = ip || req.ip;
  // Server-side rendering calls from the website share a few egress IPs; they are
  // authenticated by the secret, read-only and cached, so they skip per-IP limits.
  req.fromSsr = req.get(SSR_HEADER) === "1" && req.method === "GET" && req.path.startsWith("/api/v1/public/");
  next();
};
