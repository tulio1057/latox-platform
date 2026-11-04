import { Router, type Request } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { requirePermission, requireRecentReauth } from "../../auth/middleware";
import { ROLES } from "../../auth/permissions";
import { listSessions, revokeAllSessions } from "../../auth/session";
import { audit } from "../../lib/audit";
import { conflict, forbidden, notFound } from "../../lib/errors";
import { text } from "../../lib/fields";
import { adminAuth, COLLECTIONS, db } from "../../lib/firebase";
import { revokeFirebaseTokens } from "../../lib/identity";
import { serialize } from "../../lib/serialize";

const RT = "admin_user";
const users = () => db.collection(COLLECTIONS.adminUsers);
/** Firestore status is the authoritative gate; the Auth flag is an extra layer. */
async function setAuthDisabled(uid: string, disabled: boolean) {
  try {
    await adminAuth.updateUser(uid, { disabled });
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }
}

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const inviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(200).pipe(z.email()),
    name: text(120, 2),
    role: z.enum(ROLES),
  })
  .strict();
const roleSchema = z.object({ role: z.enum(ROLES) }).strict();

function notSelf(req: Request) {
  if (req.params.uid === req.admin!.uid) {
    throw forbidden("Você não pode alterar o próprio acesso. Peça a outro administrador.");
  }
}

export function usersRouter(): Router {
  const r = Router();
  r.use(requirePermission("users:manage"));
  r.param("uid", (_req, _res, next, uid: string) => (UID_RE.test(uid) ? next() : next(notFound())));

  async function load(uid: string) {
    const snap = await users().doc(uid).get();
    if (!snap.exists) throw notFound("Administrador não encontrado.");
    return snap;
  }

  r.get("/", async (_req, res) => {
    const snap = await users().orderBy("createdAt", "desc").get();
    res.json({
      items: snap.docs.map((d) => {
        const u = d.data();
        return serialize({
          uid: d.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          mfaEnrolled: u.mfaEnrolled ?? false,
          lastLoginAt: u.lastLoginAt ?? null,
          createdAt: u.createdAt,
        });
      }),
    });
  });

  /**
   * Invitation: creates the identity without a password. The invitee defines their own
   * password through Firebase's password-reset e-mail and must enrol TOTP on first login.
   */
  r.post("/", requireRecentReauth, async (req, res) => {
    const { email, name, role } = inviteSchema.parse(req.body);
    let uid: string;
    try {
      uid = (await adminAuth.getUserByEmail(email)).uid;
    } catch {
      uid = (await adminAuth.createUser({ email, emailVerified: false, displayName: name, disabled: false })).uid;
    }
    const ref = users().doc(uid);
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) throw conflict("Este e-mail já possui acesso administrativo.");
      tx.set(ref, {
        email,
        name,
        role,
        status: "active",
        mfaEnrolled: false,
        createdAt: Timestamp.now(),
        createdBy: req.admin!.uid,
        lastLoginAt: null,
      });
    });
    await audit(req, { action: "user.invite", resourceType: RT, resourceId: uid, result: "success", meta: { role } });
    res.status(201).json({ uid, email });
  });

  r.patch("/:uid/role", requireRecentReauth, async (req, res) => {
    notSelf(req); // nobody can elevate (or change) their own privileges
    const { role } = roleSchema.parse(req.body);
    const snap = await load(req.params.uid as string);
    const previous = snap.data()!.role;
    await snap.ref.update({ role, updatedAt: Timestamp.now(), updatedBy: req.admin!.uid });
    // Privilege change ⇒ terminate existing sessions so the new role applies to a fresh session.
    await revokeAllSessions(snap.id);
    await audit(req, { action: "user.role_change", resourceType: RT, resourceId: snap.id, result: "success", meta: { from: previous, to: role } });
    res.json({ ok: true });
  });

  r.post("/:uid/suspend", requireRecentReauth, async (req, res) => {
    notSelf(req);
    const snap = await load(req.params.uid as string);
    await snap.ref.update({ status: "suspended", updatedAt: Timestamp.now(), updatedBy: req.admin!.uid });
    await setAuthDisabled(snap.id, true);
    await revokeFirebaseTokens(snap.id);
    const revoked = await revokeAllSessions(snap.id);
    await audit(req, { action: "user.suspend", resourceType: RT, resourceId: snap.id, result: "success", meta: { revokedSessions: revoked } });
    res.json({ ok: true });
  });

  r.post("/:uid/reactivate", requireRecentReauth, async (req, res) => {
    notSelf(req);
    const snap = await load(req.params.uid as string);
    await snap.ref.update({ status: "active", updatedAt: Timestamp.now(), updatedBy: req.admin!.uid });
    await setAuthDisabled(snap.id, false);
    await audit(req, { action: "user.reactivate", resourceType: RT, resourceId: snap.id, result: "success" });
    res.json({ ok: true });
  });

  /**
   * Lost authenticator: removes the second factor so the person enrols a new one at the
   * next login. Requires re-authentication, cannot target oneself, revokes all sessions.
   */
  r.post("/:uid/reset-mfa", requireRecentReauth, async (req, res) => {
    notSelf(req);
    const snap = await load(req.params.uid as string);
    await snap.ref.update({
      totpSecretEnc: FieldValue.delete(),
      totpLastStep: FieldValue.delete(),
      recoveryCodeHashes: FieldValue.delete(),
      mfaEnrolled: false,
      updatedAt: Timestamp.now(),
      updatedBy: req.admin!.uid,
    });
    await revokeFirebaseTokens(snap.id);
    const revoked = await revokeAllSessions(snap.id);
    await audit(req, { action: "user.mfa_reset", resourceType: RT, resourceId: snap.id, result: "success", meta: { revokedSessions: revoked } });
    res.json({ ok: true });
  });

  r.post("/:uid/revoke-sessions", requirePermission("sessions:revoke"), async (req, res) => {
    const snap = await load(req.params.uid as string);
    await revokeFirebaseTokens(snap.id);
    const revoked = await revokeAllSessions(snap.id);
    await audit(req, { action: "user.revoke_sessions", resourceType: RT, resourceId: snap.id, result: "success", meta: { revokedSessions: revoked } });
    res.json({ ok: true, revoked });
  });

  r.get("/:uid/sessions", async (req, res) => {
    const snap = await load(req.params.uid as string);
    res.json({ items: await listSessions(snap.id) });
  });

  return r;
}
