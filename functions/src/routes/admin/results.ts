import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { requirePermission } from "../../auth/middleware";
import { can } from "../../auth/permissions";
import { audit } from "../../lib/audit";
import { saveRevision } from "../../lib/content";
import { forbidden, notFound } from "../../lib/errors";
import { ID_RE } from "../../lib/fields";
import { COLLECTIONS, db } from "../../lib/firebase";
import { serialize } from "../../lib/serialize";
import { confirmPublishBody, resultSchema } from "./schemas";

const RT = "selection_result";

/** Selection-process results: draft → (explicit confirmation) → published, fully audited. */
export function resultsRouter(): Router {
  const r = Router();
  const results = () => db.collection(COLLECTIONS.selectionResults);

  r.param("pid", (_req, _res, next, id: string) => (ID_RE.test(id) ? next() : next(notFound())));
  r.param("id", (_req, _res, next, id: string) => (ID_RE.test(id) ? next() : next(notFound())));

  async function loadProcess(pid: string) {
    const snap = await db.collection(COLLECTIONS.selectionProcesses).doc(pid).get();
    if (!snap.exists) throw notFound("Processo seletivo não encontrado.");
    return snap;
  }
  async function loadResult(id: string) {
    const snap = await results().doc(id).get();
    if (!snap.exists) throw notFound("Resultado não encontrado.");
    return snap;
  }

  r.get("/selection-processes/:pid/results", requirePermission("content:read"), async (req, res) => {
    await loadProcess(req.params.pid as string);
    const snap = await results().where("processId", "==", req.params.pid).get();
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ items: items.map((i) => serialize(i)) });
  });

  r.post("/selection-processes/:pid/results", requirePermission("results:write"), async (req, res) => {
    const process = await loadProcess(req.params.pid as string);
    const data = resultSchema.parse(req.body);
    const now = Timestamp.now();
    const ref = await results().add({
      ...data,
      processId: process.id,
      status: "draft",
      version: 1,
      publishAt: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: req.admin!.uid,
      updatedBy: req.admin!.uid,
    });
    await audit(req, { action: "result.create", resourceType: RT, resourceId: ref.id, result: "success", meta: { processId: process.id } });
    res.status(201).json({ id: ref.id });
  });

  r.patch("/results/:id", requirePermission("results:write"), async (req, res) => {
    const snap = await loadResult(req.params.id as string);
    const current = snap.data()!;
    const isLive = current.status === "published";
    if (isLive && !can(req.admin!.role, "results:publish")) {
      await audit(req, { action: "result.replace", resourceType: RT, resourceId: snap.id, result: "denied" });
      throw forbidden("Resultados publicados só podem ser alterados por publicadores.");
    }
    const data = resultSchema.partial().parse(req.body);
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(snap.ref);
      const version = Number(fresh.data()?.version ?? 1) + (isLive ? 1 : 0);
      tx.update(snap.ref, { ...data, version, updatedAt: Timestamp.now(), updatedBy: req.admin!.uid });
    });
    if (isLive) await saveRevision(RT, snap.id, current, req.admin!.uid, "replace_published_result");
    await audit(req, {
      action: isLive ? "result.replace" : "result.update",
      resourceType: RT,
      resourceId: snap.id,
      result: "success",
      meta: { processId: String(current.processId) },
    });
    res.json({ ok: true });
  });

  r.post("/results/:id/publish", requirePermission("results:publish"), async (req, res) => {
    const { publishAt } = confirmPublishBody.parse(req.body);
    const snap = await loadResult(req.params.id as string);
    const now = Timestamp.now();
    const at = publishAt ? Timestamp.fromDate(new Date(publishAt)) : now;
    await snap.ref.update({
      status: "published",
      publishAt: at,
      publishedAt: snap.data()!.publishedAt ?? now,
      publishedBy: req.admin!.uid,
      updatedAt: now,
    });
    await audit(req, {
      action: "result.publish",
      resourceType: RT,
      resourceId: snap.id,
      result: "success",
      meta: { processId: String(snap.data()!.processId), scheduledFor: at.toDate().toISOString() },
    });
    res.json({ ok: true });
  });

  r.post("/results/:id/unpublish", requirePermission("results:publish"), async (req, res) => {
    const snap = await loadResult(req.params.id as string);
    await snap.ref.update({ status: "draft", updatedAt: Timestamp.now(), updatedBy: req.admin!.uid });
    await audit(req, { action: "result.unpublish", resourceType: RT, resourceId: snap.id, result: "success" });
    res.json({ ok: true });
  });

  r.delete("/results/:id", requirePermission("results:publish"), requirePermission("content:delete"), async (req, res) => {
    const snap = await loadResult(req.params.id as string);
    await saveRevision(RT, snap.id, snap.data()!, req.admin!.uid, "delete");
    await snap.ref.delete();
    await audit(req, { action: "result.delete", resourceType: RT, resourceId: snap.id, result: "success" });
    res.status(204).end();
  });

  return r;
}
