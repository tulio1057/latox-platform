import { Router, type Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { config } from "../config";
import { audit } from "../lib/audit";
import { HttpError, unauthorized } from "../lib/errors";
import { COLLECTIONS, db } from "../lib/firebase";
import { verifyIdToken } from "../lib/identity";
import { memoryRateLimit, sharedRateLimit } from "../lib/rateLimit";
import { isRole, permissionsFor } from "../auth/permissions";
import { requireCsrf, requireSession, requireTrustedOrigin } from "../auth/middleware";
import { clearSessionCookie, createSession, deleteSession, setSessionCookie } from "../auth/session";

const tokenBody = z.object({ idToken: z.string().min(20).max(4096) }).strict();

/** Generic failure: never reveal whether the account exists, is suspended, etc. */
const loginFailed = () => new HttpError(401, "LOGIN_FAILED", "Não foi possível entrar. Verifique seus dados.");

async function verifyFreshMfaToken(req: Request, idToken: string): Promise<DecodedIdToken> {
  let decoded: DecodedIdToken;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    await audit(req, { action: "auth.login", result: "failure", meta: { reason: "invalid_token" } });
    throw loginFailed();
  }
  const actor = { uid: decoded.uid, email: decoded.email ?? null };
  const authAgeSeconds = Math.floor(Date.now() / 1000) - decoded.auth_time;
  if (authAgeSeconds > config.session.maxAuthAgeSeconds) {
    await audit(req, { action: "auth.login", result: "failure", actor, meta: { reason: "stale_auth" } });
    throw new HttpError(401, "LOGIN_STALE", "Sua autenticação expirou. Entre novamente.");
  }
  const secondFactor = decoded.firebase?.sign_in_second_factor;
  if (!secondFactor && !config.devAllowNoMfa) {
    await audit(req, { action: "auth.login", result: "failure", actor, meta: { reason: "mfa_missing" } });
    throw new HttpError(401, "MFA_REQUIRED", "A autenticação em dois fatores é obrigatória.");
  }
  return decoded;
}

export function authRouter(): Router {
  const r = Router();
  const loginLimiters = [
    memoryRateLimit({ windowMs: 15 * 60 * 1000, max: 20 }),
    sharedRateLimit("login", 30, 15 * 60 * 1000),
  ];

  /** Exchanges a fresh Firebase ID token (password + second factor) for a server session. */
  r.post("/session", requireTrustedOrigin, ...loginLimiters, async (req, res) => {
    const { idToken } = tokenBody.parse(req.body);
    const decoded = await verifyFreshMfaToken(req, idToken);
    const actor = { uid: decoded.uid, email: decoded.email ?? null };
    const userRef = db.collection(COLLECTIONS.adminUsers).doc(decoded.uid);
    const user = (await userRef.get()).data();
    if (!user || user.status !== "active" || !isRole(user.role)) {
      await audit(req, { action: "auth.login", result: "denied", actor, meta: { reason: "not_authorized" } });
      throw loginFailed();
    }
    // Rotation: a brand-new random session id on every successful authentication.
    const session = await createSession(decoded.uid, req, { reauth: true });
    await userRef.update({ lastLoginAt: Timestamp.now(), mfaEnrolled: Boolean(decoded.firebase?.sign_in_second_factor) });
    setSessionCookie(res, session.sessionId);
    await audit(req, { action: "auth.login", result: "success", actor });
    res.status(201).json({
      user: { uid: decoded.uid, email: user.email, name: user.name, role: user.role, permissions: permissionsFor(user.role) },
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  });

  r.get("/me", requireSession, (req, res) => {
    res.json({
      user: { ...req.admin },
      csrfToken: req.adminSession!.csrfToken,
      reauthValidUntil: req.adminSession!.reauthAt
        ? new Date(req.adminSession!.reauthAt + config.session.reauthWindowMs).toISOString()
        : null,
    });
  });

  /** Re-authentication for sensitive operations. Rotates the session identifier. */
  r.post("/reauth", requireTrustedOrigin, requireSession, requireCsrf, ...loginLimiters, async (req, res) => {
    const { idToken } = tokenBody.parse(req.body);
    const decoded = await verifyFreshMfaToken(req, idToken);
    if (decoded.uid !== req.admin!.uid) {
      await audit(req, { action: "auth.reauth", result: "denied", meta: { reason: "uid_mismatch" } });
      throw unauthorized();
    }
    const session = await createSession(decoded.uid, req, { reauth: true });
    await deleteSession(req.adminSession!.docId);
    setSessionCookie(res, session.sessionId);
    await audit(req, { action: "auth.reauth", result: "success" });
    res.json({ csrfToken: session.csrfToken });
  });

  r.post("/logout", requireTrustedOrigin, requireSession, requireCsrf, async (req, res) => {
    await deleteSession(req.adminSession!.docId);
    clearSessionCookie(res);
    await audit(req, { action: "auth.logout", result: "success" });
    res.status(204).end();
  });

  return r;
}
