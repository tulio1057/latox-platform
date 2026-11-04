/**
 * Secure initial provisioning of the first SUPER_ADMIN (there is no public sign-up and
 * no default account). Run from a trusted machine with Application Default Credentials:
 *
 *   gcloud auth application-default login
 *   GCLOUD_PROJECT=<project-id> npm run build && npm run provision-admin -- admin@exemplo.org "Nome"
 *
 * The account is created WITHOUT a password. The script prints a one-time password-setup
 * link; deliver it to the person over a trusted channel. On first login they must enrol TOTP.
 */
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, COLLECTIONS, db } from "../lib/firebase";

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Uso: npm run provision-admin -- <email> "<nome>"');
    process.exit(1);
  }
  let uid: string;
  try {
    uid = (await adminAuth.getUserByEmail(email)).uid;
  } catch {
    uid = (await adminAuth.createUser({ email, displayName: name })).uid;
  }
  await db.collection(COLLECTIONS.adminUsers).doc(uid).set(
    {
      email: email.toLowerCase(),
      name,
      role: "SUPER_ADMIN",
      status: "active",
      mfaEnrolled: false,
      createdAt: Timestamp.now(),
      createdBy: "provisioning-script",
      lastLoginAt: null,
    },
    { merge: true },
  );
  const link = await adminAuth.generatePasswordResetLink(email);
  console.log(`SUPER_ADMIN provisionado: ${email} (uid ${uid})`);
  console.log("Link único para definir a senha (não compartilhe por canais públicos):");
  console.log(link);
}

main().catch((err) => {
  console.error("Falha no provisionamento:", err instanceof Error ? err.message : err);
  process.exit(1);
});
