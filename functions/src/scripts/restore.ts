/**
 * Restores a backup produced by scripts/backup.ts. Overwrites documents with the same
 * ids; does not delete extra documents. Requires explicit confirmation of the project.
 *
 *   FIREBASE_SERVICE_ACCOUNT=<credencial do projeto de destino> npm run restore -- backup.json --confirm latox-hml
 */
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";
import { db } from "../lib/firebase";

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.__ts === "number" && Object.keys(o).length === 1) return Timestamp.fromMillis(o.__ts);
    if (typeof o.__b64 === "string" && Object.keys(o).length === 1) return Buffer.from(o.__b64, "base64");
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = decode(v);
    return out;
  }
  return value;
}

async function main() {
  const [file, flag, project] = process.argv.slice(2);
  const target = getApps()[0]?.options.projectId;
  if (!file || flag !== "--confirm" || !project || project !== target) {
    console.error("Uso: npm run restore -- <arquivo.json> --confirm <project-id>  (o ID deve ser o do projeto da credencial em uso)");
    process.exit(1);
  }
  const dump = JSON.parse(readFileSync(file, "utf8")) as { version: number; collections: Record<string, Record<string, unknown>> };
  if (dump.version !== 1) throw new Error("Versão de backup não suportada.");
  let total = 0;
  for (const [name, docs] of Object.entries(dump.collections)) {
    const entries = Object.entries(docs);
    for (let i = 0; i < entries.length; i += 400) {
      const batch = db.batch();
      for (const [id, data] of entries.slice(i, i + 400)) batch.set(db.collection(name).doc(id), decode(data) as FirebaseFirestore.DocumentData);
      await batch.commit();
    }
    total += entries.length;
  }
  console.log(`Restauração concluída: ${total} documentos em ${target}.`);
}

main().catch((err) => {
  console.error("Falha na restauração:", err instanceof Error ? err.message : err);
  process.exit(1);
});
