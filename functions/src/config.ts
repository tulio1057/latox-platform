/**
 * Centralised runtime configuration. Values come from environment variables
 * (Vercel project settings in production, functions/.env.local in development).
 * Nothing secret is committed.
 */
function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
const isProduction = !isTest && process.env.NODE_ENV === "production";

export const config = {
  isTest,
  isProduction,
  /** Exact origins allowed to send state-changing requests (CSRF Origin check + CORS). */
  allowedOrigins: list(process.env.ALLOWED_ORIGINS ?? "http://localhost:3000"),
  session: {
    cookieName: "__session",
    absoluteTtlMs: 8 * 60 * 60 * 1000,
    idleTtlMs: 60 * 60 * 1000,
    touchIntervalMs: 5 * 60 * 1000,
    maxAuthAgeSeconds: 5 * 60,
    reauthWindowMs: 10 * 60 * 1000,
  },
  mfa: {
    /** AES-256-GCM key (64 hex chars) protecting TOTP secrets at rest. Required in production. */
    encryptionKeyHex: process.env.TOTP_ENC_KEY ?? (isProduction ? "" : "0".repeat(63) + "1"),
    issuer: process.env.TOTP_ISSUER ?? "LATox Admin",
    challengeTtlMs: 5 * 60 * 1000,
    maxAttempts: 5,
    recoveryCodes: 8,
  },
  limits: {
    jsonBodyBytes: 512 * 1024,
    /** 4 MB: stays under the 4.5 MB request limit of Vercel Functions. */
    uploadBytes: 4 * 1024 * 1024,
    imageMaxPixels: 40_000_000,
    maxPageSize: 50,
  },
  /** Trusted reverse proxies in front of the API when no proxy secret is used (local dev). */
  trustProxyHops: Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "1", 10),
  /**
   * Shared secret between the website proxy (Vercel) and this API. When set, requests
   * without it are rejected (see lib/proxy.ts). Empty in development and tests.
   */
  proxySecret: process.env.API_PROXY_SECRET ?? "",
  /** Secret sent by Vercel Cron as "Authorization: Bearer <CRON_SECRET>". */
  cronSecret: process.env.CRON_SECRET ?? "",
  /** Salt for hashing IPs in logs/rate limits so raw IPs are never stored. */
  ipHashSalt: process.env.IP_HASH_SALT ?? "dev-only-salt",
};

export type Config = typeof config;
