import { Timestamp } from "firebase-admin/firestore";
import { config } from "../config";
import { randomToken, sha256 } from "../lib/crypto";
import { COLLECTIONS, db } from "../lib/firebase";

/**
 * Short-lived second-factor challenge. Created only after the password step succeeds
 * (fresh Firebase ID token); identified by a random token stored as a hash; limited
 * attempts and 5-minute lifetime.
 */
export interface ChallengeDoc {
  uid: string;
  purpose: "login" | "reauth";
  /** Present when the user is enrolling a new authenticator. */
  pendingSecretEnc: string | null;
  /** For re-authentication: the session that requested it. */
  sessionDocId: string | null;
  attempts: number;
  expiresAt: Timestamp;
}

const col = () => db.collection(COLLECTIONS.mfaChallenges);

export async function createChallenge(data: Omit<ChallengeDoc, "attempts" | "expiresAt">): Promise<string> {
  const id = randomToken(32);
  await col()
    .doc(sha256(id))
    .set({ ...data, attempts: 0, expiresAt: Timestamp.fromMillis(Date.now() + config.mfa.challengeTtlMs) });
  return id;
}

export type ChallengeState = { ok: true; docId: string; data: ChallengeDoc } | { ok: false; reason: "invalid" | "expired" | "locked" };

/** Atomically counts one attempt. Expired or exhausted challenges are removed. */
export async function takeAttempt(id: string): Promise<ChallengeState> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(id)) return { ok: false, reason: "invalid" };
  const ref = col().doc(sha256(id));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as ChallengeDoc | undefined;
    if (!data) return { ok: false, reason: "invalid" } as const;
    if (data.expiresAt.toMillis() <= Date.now()) {
      tx.delete(ref);
      return { ok: false, reason: "expired" } as const;
    }
    if (data.attempts >= config.mfa.maxAttempts) {
      tx.delete(ref);
      return { ok: false, reason: "locked" } as const;
    }
    tx.update(ref, { attempts: data.attempts + 1 });
    return { ok: true, docId: ref.id, data } as const;
  });
}

export async function deleteChallenge(docId: string) {
  await col().doc(docId).delete();
}
