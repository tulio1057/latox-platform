import express, { Router, type RequestHandler } from "express";
import { config } from "./config";
import { requireCsrf, requireSession, requireTrustedOrigin } from "./auth/middleware";
import { CONTENT_TYPES } from "./lib/content";
import { errorHandler, HttpError, notFoundHandler } from "./lib/errors";
import { trustedProxy } from "./lib/proxy";
import { memoryRateLimit } from "./lib/rateLimit";
import { authRouter } from "./routes/auth";
import { contentRouter } from "./routes/admin/content";
import { mediaRouter } from "./routes/admin/media";
import { auditRouter, dashboardRouter, settingsRouter } from "./routes/admin/misc";
import { resultsRouter } from "./routes/admin/results";
import { usersRouter } from "./routes/admin/users";
import { publicRouter } from "./routes/public";

const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  if (config.isProduction) res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.removeHeader("X-Powered-By");
  next();
};

/** Explicit allow-list CORS. Never "*" — and credentials only for listed origins. */
const cors: RequestHandler = (req, res, next) => {
  const origin = req.get("origin");
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token");
      res.setHeader("Access-Control-Max-Age", "600");
      res.status(204).end();
      return;
    }
  } else if (req.method === "OPTIONS") {
    res.status(403).end();
    return;
  }
  next();
};

/** Rejects oversized bodies up-front (the Functions runtime may already have parsed them). */
const bodySizeGuard: RequestHandler = (req, _res, next) => {
  const len = Number(req.get("content-length") ?? 0);
  const isUpload = (req.get("content-type") ?? "").startsWith("multipart/form-data");
  const limit = isUpload ? config.limits.uploadBytes + 64 * 1024 : config.limits.jsonBodyBytes;
  if (len > limit) return next(new HttpError(413, "PAYLOAD_TOO_LARGE", "Requisição muito grande."));
  next();
};

/** Only JSON is accepted on state-changing JSON endpoints (blocks form-encoded CSRF vectors). */
const requireJsonOrMultipart: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS", "DELETE"].includes(req.method)) return next();
  const type = req.get("content-type") ?? "";
  if (!type.startsWith("application/json") && !type.startsWith("multipart/form-data")) {
    return next(new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json."));
  }
  next();
};

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops);
  app.use(securityHeaders, trustedProxy, cors, bodySizeGuard, requireJsonOrMultipart);
  app.use(express.json({ limit: config.limits.jsonBodyBytes, strict: true }));
  const globalLimit = memoryRateLimit({ windowMs: 60 * 1000, max: 300 });
  app.use((req, res, next) => (req.fromSsr ? next() : globalLimit(req, res, next)));

  const v1 = Router();
  v1.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  v1.use("/public", publicRouter());
  v1.use("/auth", authRouter());

  const admin = Router();
  admin.use(requireTrustedOrigin, requireSession, requireCsrf);
  admin.use(memoryRateLimit({ windowMs: 60 * 1000, max: 120, key: (req) => `admin:${req.admin?.uid ?? req.clientIp}` }));
  admin.use("/dashboard", dashboardRouter());
  admin.use("/news", contentRouter(CONTENT_TYPES.news));
  admin.use("/projects", contentRouter(CONTENT_TYPES.projects));
  admin.use("/events", contentRouter(CONTENT_TYPES.events));
  admin.use("/team", contentRouter(CONTENT_TYPES.team));
  admin.use("/selection-processes", contentRouter(CONTENT_TYPES.selectionProcesses));
  admin.use("/", resultsRouter());
  admin.use("/media", mediaRouter());
  admin.use("/users", usersRouter());
  admin.use("/settings", settingsRouter());
  admin.use("/audit", auditRouter());
  v1.use("/admin", admin);

  app.use("/api/v1", v1);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
