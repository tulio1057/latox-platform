/**
 * Full logical backup of the Firestore data (including files stored as chunks) to a
 * single JSON file. Works on the free Spark plan (managed backups/exports need billing).
 *
 *   FIREBASE_SERVICE_ACCOUNT=... npm run backup -- backup.json
 *
 * The output contains personal data (admin e-mails, audit logs): encrypt it before
 * storing it anywhere (the GitHub workflow does this with a passphrase).
 */
import { writeFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS, db } from "../lib/firebase";

export function encode(value: unknown): unknown {
  if (value instanceof Timestamp) return { __ts: value.toMillis() };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __b64: Buffer.from(value).toString("base64") };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = encode(v);
    return out;
  }
  return value;
}

async function main() {
  const out = process.argv[2] ?? `latox-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const dump: Record<string, Record<string, unknown>> = {};
  let total = 0;
  for (const name of Object.values(COLLECTIONS)) {
    if (name === COLLECTIONS.rateLimits || name === COLLECTIONS.mfaChallenges || name === COLLECTIONS.adminSessions) continue;
    const snap = await db.collection(name).get();
    dump[name] = {};
    for (const d of snap.docs) dump[name][d.id] = encode(d.data());
    total += snap.size;
  }
  writeFileSync(out, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), collections: dump }));
  console.log(`Backup concluído: ${total} documentos em ${out}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Falha no backup:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
