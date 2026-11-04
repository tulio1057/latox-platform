import { Router, type Request, type Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { config } from "../config";
import { createChallenge, deleteChallenge, takeAttempt } from "../auth/challenge";
import { requireCsrf, requireSession, requireTrustedOrigin } from "../auth/middleware";
import { isRole, permissionsFor } from "../auth/permissions";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  loadSession,
  readSessionCookie,
  setSessionCookie,
} from "../auth/session";
import { decryptSecret, encryptSecret, hashRecoveryCode, newRecoveryCodes, newSecret, otpauthUrl, verifyCode } from "../auth/totp";
import { audit } from "../lib/audit";
import { HttpError, unauthorized } from "../lib/errors";
import { COLLECTIONS, db } from "../lib/firebase";
import { verifyIdToken } from "../lib/identity";
import { memoryRateLimit, sharedRateLimit } from "../lib/rateLimit";

const tokenBody = z.object({ idToken: z.string().min(20).max(4096) }).strict();
const mfaBody = z
  .object({
    challenge: z.string().min(40).max(64),
    code: z.string().regex(/^\d{6}$/).optional(),
    recoveryCode: z.string().trim().max(20).optional(),
  })
  .strict()
  .refine((b) => Boolean(b.code) !== Boolean(b.recoveryCode), "Informe o código do autenticador OU um código de recuperação.");

/** Generic failure: never reveal whether the account exists, is suspended, etc. */
const loginFailed = () => new HttpError(401, "LOGIN_FAILED", "Não foi possível entrar. Verifique seus dados.");
const mfaFailed = () => new HttpError(401, "MFA_INVALID", "Código inválido ou expirado.");

/** Step 1 helper: a fresh Firebase ID token proves the password (verified by Google). */
async function verifyFreshToken(req: Request, idToken: string): Promise<DecodedIdToken> {
  let decoded: DecodedIdToken;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    await audit(req, { action: "auth.login", result: "failure", meta: { reason: "invalid_token" } });
    throw loginFailed();
  }
  const age = Math.floor(Date.now() / 1000) - decoded.auth_time;
  if (age > config.session.maxAuthAgeSeconds) {
    await audit(req, { action: "auth.login", result: "failure", actor: { uid: decoded.uid, email: decoded.email ?? null }, meta: { reason: "stale_auth" } });
    throw new HttpError(401, "LOGIN_STALE", "Sua autenticação expirou. Entre novamente.");
  }
  return decoded;
}

async function loadActiveAdmin(uid: string) {
  const ref = db.collection(COLLECTIONS.adminUsers).doc(uid);
  const user = (await ref.get()).data();
  if (!user || user.status !== "active" || !isRole(user.role)) return null;
  return { ref, user };
}

export function authRouter(): Router {
  const r = Router();
  const limiters = [memoryRateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), sharedRateLimit("login", 30, 15 * 60 * 1000)];

  /**
   * Step 1 — password. Returns a second-factor challenge (never a session).
   * Admins without an authenticator get an enrolment challenge with a new secret.
   */
  r.post("/session", requireTrustedOrigin, ...limiters, async (req, res) => {
    const { idToken } = tokenBody.parse(req.body);
    const decoded = await verifyFreshToken(req, idToken);
    const actor = { uid: decoded.uid, email: decoded.email ?? null };
    const admin = await loadActiveAdmin(decoded.uid);
    if (!admin) {
      await audit(req, { action: "auth.login", result: "denied", actor, meta: { reason: "not_authorized" } });
      throw loginFailed();
    }
    if (admin.user.totpSecretEnc) {
      const challenge = await createChallenge({ uid: decoded.uid, purpose: "login", pendingSecretEnc: null, sessionDocId: null });
      res.json({ mfa: "verify", challenge });
      return;
    }
    const secret = newSecret();
    const challenge = await createChallenge({ uid: decoded.uid, purpose: "login", pendingSecretEnc: encryptSecret(secret), sessionDocId: null });
    res.json({ mfa: "enroll", challenge, otpauthUrl: otpauthUrl(secret, String(admin.user.email ?? decoded.email ?? "admin")), secret });
  });

  /** Step 2 — second factor (enrolment, TOTP code or recovery code). */
  r.post("/mfa", requireTrustedOrigin, ...limiters, async (req, res) => {
    const body = mfaBody.parse(req.body);
    const state = await takeAttempt(body.challenge);
    if (!state.ok) {
      await audit(req, { action: "auth.mfa", result: "failure", meta: { reason: state.reason } });
      throw mfaFailed();
    }
    const { data, docId } = state;
    const actorRef = { uid: data.uid, email: null };
    const admin = await loadActiveAdmin(data.uid);
    if (!admin) {
      await deleteChallenge(docId);
      await audit(req, { action: "auth.mfa", result: "denied", actor: actorRef, meta: { reason: "not_authorized" } });
      throw loginFailed();
    }
    const actor = { uid: data.uid, email: (admin.user.email as string) ?? null };

    // Re-authentication must come from the same browser session that asked for it.
    let currentSession: Awaited<ReturnType<typeof loadSession>> = null;
    if (data.purpose === "reauth") {
      const sid = readSessionCookie(req);
      currentSession = sid ? await loadSession(sid) : null;
      if (!currentSession || currentSession.docId !== data.sessionDocId || currentSession.data.uid !== data.uid) {
        await audit(req, { action: "auth.reauth", result: "denied", actor, meta: { reason: "session_mismatch" } });
        throw unauthorized();
      }
    }

    let recoveryCodes: string[] | undefined;
    if (data.pendingSecretEnc) {
      // Enrolment: prove possession of the new authenticator.
      const secret = decryptSecret(data.pendingSecretEnc);
      const step = body.code ? verifyCode(secret, body.code, null) : null;
      if (step === null) {
        await audit(req, { action: "auth.mfa_enroll", result: "failure", actor });
        throw mfaFailed();
      }
      const rc = newRecoveryCodes();
      recoveryCodes = rc.codes;
      await admin.ref.update({
        totpSecretEnc: data.pendingSecretEnc,
        totpLastStep: step,
        recoveryCodeHashes: rc.hashes,
        mfaEnrolled: true,
        mfaEnrolledAt: Timestamp.now(),
      });
      await audit(req, { action: "auth.mfa_enroll", result: "success", actor });
    } else if (body.code) {
      const secret = decryptSecret(String(admin.user.totpSecretEnc));
      const step = verifyCode(secret, body.code, typeof admin.user.totpLastStep === "number" ? admin.user.totpLastStep : null);
      if (step === null) {
        await audit(req, { action: "auth.mfa", result: "failure", actor, meta: { purpose: data.purpose } });
        throw mfaFailed();
      }
      await admin.ref.update({ totpLastStep: step });
    } else {
      const hash = hashRecoveryCode(body.recoveryCode ?? "");
      const hashes: string[] = Array.isArray(admin.user.recoveryCodeHashes) ? admin.user.recoveryCodeHashes : [];
      if (!hashes.includes(hash)) {
        await audit(req, { action: "auth.mfa_recovery", result: "failure", actor });
        throw mfaFailed();
      }
      await admin.ref.update({ recoveryCodeHashes: FieldValue.arrayRemove(hash) });
      await audit(req, { action: "auth.mfa_recovery", result: "success", actor, meta: { remaining: hashes.length - 1 } });
    }
    await deleteChallenge(docId);

    if (data.purpose === "reauth") {
      const session = await createSession(data.uid, req, { reauth: true });
      await deleteSession(currentSession!.docId);
      setSessionCookie(res, session.sessionId);
      await audit(req, { action: "auth.reauth", result: "success", actor });
      res.json({ csrfToken: session.csrfToken, recoveryCodes });
      return;
    }
    await finishLogin(req, res, data.uid, admin.ref, admin.user, recoveryCodes);
  });

  r.get("/me", requireSession, (req, res) => {
    res.json({
      user: { ...req.admin },
      csrfToken: req.adminSession!.csrfToken,
      reauthValidUntil: req.adminSession!.reauthAt ? new Date(req.adminSession!.reauthAt + config.session.reauthWindowMs).toISOString() : null,
    });
  });

  /** Re-authentication for sensitive operations: password (ID token) then TOTP via /mfa. */
  r.post("/reauth", requireTrustedOrigin, requireSession, requireCsrf, ...limiters, async (req, res) => {
    const { idToken } = tokenBody.parse(req.body);
    const decoded = await verifyFreshToken(req, idToken);
    if (decoded.uid !== req.admin!.uid) {
      await audit(req, { action: "auth.reauth", result: "denied", meta: { reason: "uid_mismatch" } });
      throw unauthorized();
    }
    const challenge = await createChallenge({ uid: decoded.uid, purpose: "reauth", pendingSecretEnc: null, sessionDocId: req.adminSession!.docId });
    res.json({ mfa: "verify", challenge });
  });

  r.post("/logout", requireTrustedOrigin, requireSession, requireCsrf, async (req, res) => {
    await deleteSession(req.adminSession!.docId);
    clearSessionCookie(res);
    await audit(req, { action: "auth.logout", result: "success" });
    res.status(204).end();
  });

  return r;
}

async function finishLogin(
  req: Request,
  res: Response,
  uid: string,
  ref: FirebaseFirestore.DocumentReference,
  user: FirebaseFirestore.DocumentData,
  recoveryCodes?: string[],
) {
  // Rotation: a brand-new random session id on every successful authentication.
  const session = await createSession(uid, req, { reauth: true });
  await ref.update({ lastLoginAt: Timestamp.now() });
  setSessionCookie(res, session.sessionId);
  await audit(req, { action: "auth.login", result: "success", actor: { uid, email: (user.email as string) ?? null } });
  res.status(201).json({
    user: { uid, email: user.email, name: user.name, role: user.role, permissions: permissionsFor(user.role) },
    csrfToken: session.csrfToken,
    expiresAt: new Date(session.expiresAt).toISOString(),
    recoveryCodes,
  });
}
