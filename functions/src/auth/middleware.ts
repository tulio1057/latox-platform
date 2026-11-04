import type { RequestHandler } from "express";
import { config } from "../config";
import { audit } from "../lib/audit";
import { safeEqual } from "../lib/crypto";
import { forbidden, HttpError, unauthorized } from "../lib/errors";
import { COLLECTIONS, db } from "../lib/firebase";
import { can, isRole, permissionsFor, type Permission } from "./permissions";
import { clearSessionCookie, loadSession, readSessionCookie } from "./session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Resolves the admin from the server-side session. Rejects unless the account is active. */
export const requireSession: RequestHandler = async (req, res, next) => {
  const sessionId = readSessionCookie(req);
  if (!sessionId) return next(unauthorized());
  const session = await loadSession(sessionId);
  if (!session) {
    clearSessionCookie(res);
    return next(unauthorized("Sessão expirada. Entre novamente."));
  }
  const userSnap = await db.collection(COLLECTIONS.adminUsers).doc(session.data.uid).get();
  const user = userSnap.data();
  if (!user || user.status !== "active" || !isRole(user.role)) {
    clearSessionCookie(res);
    return next(unauthorized());
  }
  req.admin = {
    uid: session.data.uid,
    email: typeof user.email === "string" ? user.email : null,
    name: typeof user.name === "string" ? user.name : "",
    role: user.role,
    permissions: permissionsFor(user.role),
  };
  req.adminSession = {
    docId: session.docId,
    csrfToken: session.data.csrfToken,
    reauthAt: session.data.reauthAt ? session.data.reauthAt.toMillis() : null,
  };
  next();
};

/** Origin allow-list check. Applied to every state-changing request, including login. */
export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin || !config.allowedOrigins.includes(origin)) {
    return next(new HttpError(403, "CSRF_ORIGIN", "Origem da requisição não permitida."));
  }
  next();
};

/** Synchronizer-token CSRF check (in addition to SameSite=Strict and the Origin check). */
export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const header = req.get("x-csrf-token") ?? "";
  if (!req.adminSession || !header || !safeEqual(header, req.adminSession.csrfToken)) {
    return next(new HttpError(403, "CSRF_TOKEN", "Token CSRF inválido."));
  }
  next();
};

export function requirePermission(permission: Permission): RequestHandler {
  return async (req, _res, next) => {
    if (!req.admin) return next(unauthorized());
    if (!can(req.admin.role, permission)) {
      await audit(req, {
        action: "authz.denied",
        result: "denied",
        meta: { permission, method: req.method, path: req.path.slice(0, 120) },
      });
      return next(forbidden("Você não tem permissão para esta ação."));
    }
    next();
  };
}

/** Sensitive operations need a fresh password + MFA confirmation (POST /auth/reauth). */
export const requireRecentReauth: RequestHandler = (req, _res, next) => {
  const at = req.adminSession?.reauthAt;
  if (!at || Date.now() - at > config.session.reauthWindowMs) {
    return next(new HttpError(403, "REAUTH_REQUIRED", "Confirme sua identidade para continuar."));
  }
  next();
};
