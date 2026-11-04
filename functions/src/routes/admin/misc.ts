import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { requirePermission } from "../../auth/middleware";
import { can } from "../../auth/permissions";
import { audit } from "../../lib/audit";
import { CONTENT_TYPES, paginate, saveRevision } from "../../lib/content";
import { COLLECTIONS, db } from "../../lib/firebase";
import { serialize } from "../../lib/serialize";
import { getSettings, settingsRef, settingsSchema } from "../../lib/settings";
import { config } from "../../config";

export function settingsRouter(): Router {
  const r = Router();
  r.get("/", requirePermission("content:read"), async (_req, res) => {
    res.json(serialize(await getSettings()));
  });
  r.put("/", requirePermission("settings:write"), async (req, res) => {
    const data = settingsSchema.parse(req.body);
    const current = await getSettings();
    await settingsRef().set({ ...data, updatedAt: Timestamp.now(), updatedBy: req.admin!.uid });
    await saveRevision("settings", "site", current, req.admin!.uid, "update");
    const changed = Object.keys(data).filter(
      (k) => JSON.stringify(data[k as keyof typeof data]) !== JSON.stringify(current[k as keyof typeof current]),
    );
    await audit(req, { action: "settings.update", resourceType: "settings", resourceId: "site", result: "success", meta: { fields: changed.join(",").slice(0, 300) } });
    res.json({ ok: true });
  });
  return r;
}

export function auditRouter(): Router {
  const r = Router();
  r.get("/", requirePermission("audit:read"), async (req, res) => {
    let q = db.collection(COLLECTIONS.auditLogs).orderBy("at", "desc").limit(1000);
    const actorUid = String(req.query.actorUid ?? "");
    if (/^[A-Za-z0-9_-]{1,128}$/.test(actorUid)) q = db.collection(COLLECTIONS.auditLogs).where("actorUid", "==", actorUid).limit(1000);
    const snap = await q.get();
    const action = String(req.query.action ?? "").slice(0, 60);
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
      .filter((d) => !action || String(d.action).startsWith(action))
      .sort((a, b) => ((b.at as Timestamp)?.toMillis?.() ?? 0) - ((a.at as Timestamp)?.toMillis?.() ?? 0))
      .map((d) => serialize(d));
    res.json(paginate(items, req.query.page, req.query.pageSize, config.limits.maxPageSize));
  });
  return r;
}

export function dashboardRouter(): Router {
  const r = Router();
  r.get("/", requirePermission("content:read"), async (req, res) => {
    const count = async (collection: string, status?: string) => {
      const base = db.collection(collection);
      const q = status ? base.where("status", "==", status) : base;
      return (await q.count().get()).data().count;
    };
    const now = Timestamp.now();
    const [news, projects, newsDrafts, projectDrafts, eventDrafts, processDrafts, publishedResults] = await Promise.all([
      count(COLLECTIONS.news),
      count(COLLECTIONS.projects),
      count(COLLECTIONS.news, "draft"),
      count(COLLECTIONS.projects, "draft"),
      count(COLLECTIONS.events, "draft"),
      count(COLLECTIONS.selectionProcesses, "draft"),
      count(COLLECTIONS.selectionResults, "published"),
    ]);
    const eventsSnap = await db.collection(CONTENT_TYPES.events.collection).where("startAt", ">=", now).orderBy("startAt").limit(5).get();
    const processesSnap = await db.collection(COLLECTIONS.selectionProcesses).where("status", "==", "published").get();
    const activeProcesses = processesSnap.docs.filter((d) => d.data().phase !== "finalizado");

    let activityQuery = db.collection(COLLECTIONS.auditLogs).orderBy("at", "desc").limit(10);
    if (!can(req.admin!.role, "audit:read")) {
      activityQuery = db.collection(COLLECTIONS.auditLogs).where("actorUid", "==", req.admin!.uid).limit(50);
    }
    const activity = (await activityQuery.get()).docs
      .map((d) => d.data())
      .sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0))
      .slice(0, 10)
      .map((d) => serialize({ action: d.action, actorEmail: d.actorEmail, resourceType: d.resourceType, resourceId: d.resourceId, result: d.result, at: d.at }));

    res.json({
      totals: {
        news,
        projects,
        drafts: newsDrafts + projectDrafts + eventDrafts + processDrafts,
        publishedResults,
        activeProcesses: activeProcesses.length,
      },
      upcomingEvents: eventsSnap.docs.map((d) => serialize({ id: d.id, title: d.data().title, startAt: d.data().startAt, status: d.data().status })),
      activeProcesses: activeProcesses.map((d) => ({ id: d.id, title: d.data().title, phase: d.data().phase })),
      activity,
    });
  });
  return r;
}
