import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { config } from "../config";
import { COLLECTIONS, db } from "../lib/firebase";
import { hashIp, randomToken, sha256 } from "../lib/crypto";

/**
 * Server-side sessions. The browser only holds an opaque random identifier in an
 * HttpOnly cookie; Firestore stores sha256(identifier) so a database leak does not
 * expose usable session tokens. Each session carries its own CSRF synchronizer token.
 */
export interface SessionDoc {
  uid: string;
  csrfToken: string;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  expiresAt: Timestamp;
  reauthAt: Timestamp | null;
  userAgent: string;
  ipHash: string;
}

const sessions = () => db.collection(COLLECTIONS.adminSessions);

export async function createSession(uid: string, req: Request, opts: { reauth?: boolean } = {}) {
  const sessionId = randomToken(32);
  const csrfToken = randomToken(32);
  const now = Date.now();
  const doc: SessionDoc = {
    uid,
    csrfToken,
    createdAt: Timestamp.fromMillis(now),
    lastSeenAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + config.session.absoluteTtlMs),
    reauthAt: opts.reauth ? Timestamp.fromMillis(now) : null,
    userAgent: String(req.get("user-agent") ?? "").slice(0, 200),
    ipHash: hashIp(req.clientIp),
  };
  await sessions().doc(sha256(sessionId)).set(doc);
  return { sessionId, csrfToken, docId: sha256(sessionId), expiresAt: now + config.session.absoluteTtlMs };
}

export async function loadSession(sessionId: string): Promise<{ docId: string; data: SessionDoc } | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(sessionId)) return null;
  const docId = sha256(sessionId);
  const ref = sessions().doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as SessionDoc;
  const now = Date.now();
  if (data.expiresAt.toMillis() <= now || now - data.lastSeenAt.toMillis() > config.session.idleTtlMs) {
    await ref.delete().catch(() => undefined);
    return null;
  }
  if (now - data.lastSeenAt.toMillis() > config.session.touchIntervalMs) {
    await ref.update({ lastSeenAt: Timestamp.fromMillis(now) }).catch(() => undefined);
  }
  return { docId, data };
}

export async function deleteSession(docId: string): Promise<void> {
  await sessions().doc(docId).delete();
}

export async function revokeAllSessions(uid: string): Promise<number> {
  const snap = await sessions().where("uid", "==", uid).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

export async function listSessions(uid: string) {
  const snap = await sessions().where("uid", "==", uid).get();
  return snap.docs.map((d) => {
    const s = d.data() as SessionDoc;
    return {
      createdAt: s.createdAt.toDate().toISOString(),
      lastSeenAt: s.lastSeenAt.toDate().toISOString(),
      expiresAt: s.expiresAt.toDate().toISOString(),
      userAgent: s.userAgent,
    };
  });
}

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === config.session.cookieName) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(config.session.cookieName, sessionId, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: config.session.absoluteTtlMs,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.session.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/",
  });
}
