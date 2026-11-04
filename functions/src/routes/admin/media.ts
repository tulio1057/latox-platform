import { Router, type Response } from "express";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { logger } from "../../lib/log";
import { z } from "zod";
import { config } from "../../config";
import { requirePermission } from "../../auth/middleware";
import { audit } from "../../lib/audit";
import { paginate } from "../../lib/content";
import { badRequest, notFound } from "../../lib/errors";
import { ID_RE, text } from "../../lib/fields";
import { deleteBlob, getBlob, putBlob, type BlobRef } from "../../lib/blobStore";
import { COLLECTIONS, db } from "../../lib/firebase";
import { displayName, parseMultipart, validateAndProcess, type ProcessedFile } from "../../lib/media";
import { mediaUrl, serialize } from "../../lib/serialize";

const RT = "media";
const media = () => db.collection(COLLECTIONS.media);

function toDto(id: string, d: DocumentData) {
  return serialize({
    id,
    name: d.name,
    kind: d.kind,
    mimeType: d.mimeType,
    size: d.size,
    width: d.width ?? null,
    height: d.height ?? null,
    isPublic: d.isPublic,
    folder: d.folder ?? "geral",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    uploadedBy: d.uploadedBy,
    url: mediaUrl(id),
  });
}

/** Server-generated blob key: the client filename never reaches storage. */
async function store(id: string, file: ProcessedFile): Promise<BlobRef> {
  return putBlob(`${id}-${Date.now().toString(36)}`, file.buffer);
}

const blobRef = (d: DocumentData): BlobRef => ({ blobKey: String(d.blobKey), chunkCount: Number(d.chunkCount ?? 0) });

/** Sends a stored file with hardened headers. Uploaded files are never executed. */
export async function streamMedia(res: Response, d: DocumentData, cacheControl: string) {
  const data = await getBlob(blobRef(d));
  if (!data) {
    logger.error("media blob missing", { blobKey: String(d.blobKey) });
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", String(d.mimeType));
  res.setHeader("Content-Length", String(data.length));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  const safeName = String(d.name ?? "arquivo").replace(/[^\w. -]/g, "_");
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  res.end(data);
}

const FOLDERS = ["geral", "imagens", "editais", "documentos", "eventos"] as const;
const patchSchema = z
  .object({ name: text(120, 1).optional(), isPublic: z.boolean().optional(), folder: z.enum(FOLDERS).optional() })
  .strict();

export function mediaRouter(): Router {
  const r = Router();
  r.param("id", (_req, _res, next, id: string) => (ID_RE.test(id) ? next() : next(notFound())));

  async function load(id: string) {
    const snap = await media().doc(id).get();
    if (!snap.exists) throw notFound("Arquivo não encontrado.");
    return snap;
  }

  r.get("/", requirePermission("content:read"), async (req, res) => {
    const snap = await media().orderBy("createdAt", "desc").limit(1000).get();
    const kind = String(req.query.kind ?? "");
    const folder = String(req.query.folder ?? "");
    const items = snap.docs
      .filter((d) => !kind || d.data().kind === kind)
      .filter((d) => !folder || d.data().folder === folder)
      .map((d) => toDto(d.id, d.data()));
    res.json(paginate(items, req.query.page, req.query.pageSize, config.limits.maxPageSize));
  });

  r.post("/", requirePermission("media:upload"), async (req, res) => {
    const upload = await parseMultipart(req);
    const file = await validateAndProcess(upload.buffer, upload.filename, upload.mimeType);
    const folder = (FOLDERS as readonly string[]).includes(upload.fields.folder ?? "") ? upload.fields.folder : "geral";
    const ref = media().doc();
    const blob = await store(ref.id, file);
    const now = Timestamp.now();
    const data = {
      name: displayName(upload.filename),
      kind: file.kind,
      mimeType: file.mimeType,
      size: file.buffer.length,
      width: file.width ?? null,
      height: file.height ?? null,
      blobKey: blob.blobKey,
      chunkCount: blob.chunkCount,
      isPublic: upload.fields.isPublic !== "false",
      folder,
      createdAt: now,
      updatedAt: now,
      uploadedBy: req.admin!.uid,
    };
    await ref.set(data);
    await audit(req, { action: "media.upload", resourceType: RT, resourceId: ref.id, result: "success", meta: { kind: file.kind, size: data.size } });
    res.status(201).json(toDto(ref.id, data));
  });

  r.patch("/:id", requirePermission("media:upload"), async (req, res) => {
    const snap = await load(req.params.id as string);
    const data = patchSchema.parse(req.body);
    await snap.ref.update({ ...data, updatedAt: Timestamp.now() });
    await audit(req, {
      action: "media.update",
      resourceType: RT,
      resourceId: snap.id,
      result: "success",
      meta: { isPublic: data.isPublic ?? null },
    });
    res.json({ ok: true });
  });

  /** Replace the binary, keeping the same id (and therefore every reference to it). */
  r.put("/:id/file", requirePermission("media:delete"), async (req, res) => {
    const snap = await load(req.params.id as string);
    const old = snap.data()!;
    const upload = await parseMultipart(req);
    const file = await validateAndProcess(upload.buffer, upload.filename, upload.mimeType);
    if (file.kind !== old.kind) throw badRequest("O novo arquivo deve ser do mesmo tipo do original.");
    const blob = await store(snap.id, file);
    await snap.ref.update({
      blobKey: blob.blobKey,
      chunkCount: blob.chunkCount,
      mimeType: file.mimeType,
      size: file.buffer.length,
      width: file.width ?? null,
      height: file.height ?? null,
      updatedAt: Timestamp.now(),
    });
    await deleteBlob(blobRef(old));
    await audit(req, { action: "media.replace", resourceType: RT, resourceId: snap.id, result: "success" });
    res.json({ ok: true });
  });

  r.delete("/:id", requirePermission("media:delete"), async (req, res) => {
    const snap = await load(req.params.id as string);
    await deleteBlob(blobRef(snap.data()!));
    await snap.ref.delete();
    await audit(req, { action: "media.delete", resourceType: RT, resourceId: snap.id, result: "success" });
    res.status(204).end();
  });

  /** Authenticated access to any file, including private ones. */
  r.get("/:id/file", requirePermission("content:read"), async (req, res) => {
    const snap = await load(req.params.id as string);
    await streamMedia(res, snap.data()!, "private, no-store");
  });

  return r;
}
