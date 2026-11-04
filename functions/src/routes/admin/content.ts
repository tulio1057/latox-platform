import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { config } from "../../config";
import { requirePermission } from "../../auth/middleware";
import { can } from "../../auth/permissions";
import { audit } from "../../lib/audit";
import {
  normaliseDates,
  normaliseSearch,
  paginate,
  saveRevision,
  uniqueSlug,
  type ContentType,
} from "../../lib/content";
import { forbidden, notFound } from "../../lib/errors";
import { ID_RE } from "../../lib/fields";
import { db } from "../../lib/firebase";
import { serialize } from "../../lib/serialize";
import { publishBody } from "./schemas";

const STATUSES = new Set(["draft", "published", "archived"]);

/** Generic admin CRUD + publication workflow for one content type. */
export function contentRouter(type: ContentType): Router {
  const r = Router();
  const col = () => db.collection(type.collection);

  r.param("id", (_req, _res, next, id: string) => (ID_RE.test(id) ? next() : next(notFound())));

  async function load(id: string) {
    const snap = await col().doc(id).get();
    if (!snap.exists) throw notFound();
    return snap;
  }

  r.get("/", requirePermission("content:read"), async (req, res) => {
    const snap = await col().orderBy("updatedAt", "desc").limit(1000).get();
    const status = String(req.query.status ?? "");
    const q = normaliseSearch(String(req.query.q ?? "").slice(0, 100));
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string })
      .filter((d) => !STATUSES.has(status) || d.status === status)
      .filter((d) => !q || normaliseSearch(String(d.title ?? d.name ?? "")).includes(q));
    const page = paginate(items, req.query.page, req.query.pageSize, config.limits.maxPageSize);
    res.json({ ...page, items: page.items.map((i) => serialize(i)) });
  });

  r.get("/:id", requirePermission("content:read"), async (req, res) => {
    const snap = await load(req.params.id as string);
    res.json(serialize({ id: snap.id, ...snap.data() }));
  });

  r.post("/", requirePermission("content:write"), async (req, res) => {
    const data = normaliseDates(type, type.schema.parse(req.body) as Record<string, unknown>);
    if (type.slugSource) {
      data.slug = await uniqueSlug(type.collection, String(data.slug ?? data[type.slugSource]));
    }
    const now = Timestamp.now();
    const ref = await col().add({
      ...data,
      status: "draft",
      publishAt: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: req.admin!.uid,
      updatedBy: req.admin!.uid,
    });
    await audit(req, { action: `${type.resourceType}.create`, resourceType: type.resourceType, resourceId: ref.id, result: "success" });
    res.status(201).json({ id: ref.id });
  });

  r.patch("/:id", requirePermission("content:write"), async (req, res) => {
    const snap = await load(req.params.id as string);
    const current = snap.data()!;
    // Editors cannot change live content: that would be publishing without permission.
    if (current.status === "published" && !can(req.admin!.role, "content:publish")) {
      await audit(req, { action: `${type.resourceType}.update`, resourceType: type.resourceType, resourceId: snap.id, result: "denied" });
      throw forbidden("Conteúdo publicado só pode ser alterado por publicadores.");
    }
    const data = normaliseDates(type, type.schema.partial().parse(req.body) as Record<string, unknown>);
    if (type.slugSource && data.slug !== undefined) {
      data.slug = await uniqueSlug(type.collection, String(data.slug), snap.id);
    }
    await db.runTransaction(async (tx) => {
      tx.update(snap.ref, { ...data, updatedAt: Timestamp.now(), updatedBy: req.admin!.uid });
    });
    if (current.status === "published") {
      await saveRevision(type.resourceType, snap.id, current, req.admin!.uid, "update_published");
    }
    await audit(req, {
      action: `${type.resourceType}.update`,
      resourceType: type.resourceType,
      resourceId: snap.id,
      result: "success",
      meta: { fields: Object.keys(data).join(",").slice(0, 300) },
    });
    res.json({ ok: true });
  });

  r.delete("/:id", requirePermission("content:delete"), async (req, res) => {
    const snap = await load(req.params.id as string);
    await saveRevision(type.resourceType, snap.id, snap.data()!, req.admin!.uid, "delete");
    await snap.ref.delete();
    await audit(req, { action: `${type.resourceType}.delete`, resourceType: type.resourceType, resourceId: snap.id, result: "success" });
    res.status(204).end();
  });

  r.post("/:id/publish", requirePermission("content:publish"), async (req, res) => {
    const { publishAt } = publishBody.parse(req.body ?? {});
    const snap = await load(req.params.id as string);
    const now = Timestamp.now();
    const at = publishAt ? Timestamp.fromDate(new Date(publishAt)) : now;
    await snap.ref.update({
      status: "published",
      publishAt: at,
      publishedAt: snap.data()!.publishedAt ?? now,
      publishedBy: req.admin!.uid,
      updatedAt: now,
      updatedBy: req.admin!.uid,
    });
    await audit(req, {
      action: `${type.resourceType}.publish`,
      resourceType: type.resourceType,
      resourceId: snap.id,
      result: "success",
      meta: { scheduledFor: at.toDate().toISOString() },
    });
    res.json({ ok: true, publishAt: at.toDate().toISOString() });
  });

  for (const [action, status] of [
    ["unpublish", "draft"],
    ["archive", "archived"],
  ] as const) {
    r.post(`/:id/${action}`, requirePermission("content:publish"), async (req, res) => {
      const snap = await load(req.params.id as string);
      await snap.ref.update({ status, updatedAt: Timestamp.now(), updatedBy: req.admin!.uid });
      await audit(req, { action: `${type.resourceType}.${action}`, resourceType: type.resourceType, resourceId: snap.id, result: "success" });
      res.json({ ok: true });
    });
  }

  return r;
}
