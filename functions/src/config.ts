/**
 * Centralised runtime configuration. Values come from environment variables
 * (functions/.env.<projectId> in deployed environments, never committed).
 */
function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export const config = {
  isEmulator,
  isTest,
  isProduction: !isEmulator && !isTest,
  region: process.env.LATOX_REGION ?? "southamerica-east1",
  /** Exact origins allowed to send state-changing requests (CSRF Origin check + CORS). */
  allowedOrigins: list(process.env.ALLOWED_ORIGINS ?? "http://localhost:3000"),
  /**
   * Local-only escape hatch: the Firebase Auth emulator cannot issue TOTP second factors.
   * Only honoured when running inside the Functions emulator; ignored everywhere else.
   */
  devAllowNoMfa: isEmulator && process.env.DEV_ALLOW_NO_MFA === "true",
  session: {
    cookieName: "__session", // Firebase Hosting only forwards this cookie name to functions.
    absoluteTtlMs: 8 * 60 * 60 * 1000,
    idleTtlMs: 60 * 60 * 1000,
    touchIntervalMs: 5 * 60 * 1000,
    maxAuthAgeSeconds: 5 * 60,
    reauthWindowMs: 10 * 60 * 1000,
  },
  limits: {
    jsonBodyBytes: 512 * 1024,
    uploadBytes: 15 * 1024 * 1024,
    imageMaxPixels: 40_000_000,
    maxPageSize: 50,
  },
  /**
   * Number of trusted reverse proxies in front of the function (Google Front End = 1).
   * The client IP is taken from X-Forwarded-For counting from the right, so values a
   * client injects on the left cannot spoof it. Verify in staging (see docs/security).
   */
  trustProxyHops: Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "1", 10),
  /** Salt for hashing IPs in logs/rate limits so raw IPs are never stored. */
  ipHashSalt: process.env.IP_HASH_SALT ?? "dev-only-salt",
};

export type Config = typeof config;
