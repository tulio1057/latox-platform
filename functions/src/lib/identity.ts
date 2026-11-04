import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "./firebase";

/**
 * Thin wrapper around Firebase ID token verification so it can be replaced in tests.
 * checkRevoked=true rejects tokens of users whose refresh tokens were revoked.
 */
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  return adminAuth.verifyIdToken(idToken, true);
}

export async function revokeFirebaseTokens(uid: string): Promise<void> {
  await adminAuth.revokeRefreshTokens(uid);
}
