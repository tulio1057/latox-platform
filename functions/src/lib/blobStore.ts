import { COLLECTIONS, db } from "./firebase";

/**
 * File storage inside Firestore (works on the free Spark plan, which has no Cloud
 * Storage). Each file is split into ≤ 900 KB binary chunks — below Firestore's 1 MiB
 * document limit. Chunks are only reachable through the API, which enforces visibility
 * and permissions; Firestore rules deny all client access.
 */
const CHUNK_BYTES = 900 * 1024;
const chunks = () => db.collection(COLLECTIONS.mediaChunks);

export interface BlobRef {
  blobKey: string;
  chunkCount: number;
}

const chunkId = (blobKey: string, i: number) => `${blobKey}_${String(i).padStart(3, "0")}`;

export async function putBlob(blobKey: string, data: Buffer): Promise<BlobRef> {
  const count = Math.max(1, Math.ceil(data.length / CHUNK_BYTES));
  const batch = db.batch();
  for (let i = 0; i < count; i++) {
    batch.set(chunks().doc(chunkId(blobKey, i)), {
      blobKey,
      index: i,
      data: data.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES),
    });
  }
  await batch.commit();
  return { blobKey, chunkCount: count };
}

export async function getBlob(ref: BlobRef): Promise<Buffer | null> {
  const refs = Array.from({ length: ref.chunkCount }, (_, i) => chunks().doc(chunkId(ref.blobKey, i)));
  if (!refs.length) return null;
  const snaps = await db.getAll(...refs);
  const parts: Buffer[] = [];
  for (const s of snaps) {
    const d = s.data();
    if (!d) return null;
    parts.push(Buffer.from(d.data as Uint8Array));
  }
  return Buffer.concat(parts);
}

export async function deleteBlob(ref: BlobRef): Promise<void> {
  const batch = db.batch();
  for (let i = 0; i < ref.chunkCount; i++) batch.delete(chunks().doc(chunkId(ref.blobKey, i)));
  await batch.commit();
}
