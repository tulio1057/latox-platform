import { Router, type RequestHandler } from "express";
import {
  CONTENT_TYPES,
  isPubliclyVisible,
  loadPublished,
  normaliseSearch,
  paginate,
  toPublic,
  type ContentType,
} from "../lib/content";
import { notFound } from "../lib/errors";
import { ID_RE } from "../lib/fields";
import { COLLECTIONS, db } from "../lib/firebase";
import { SLUG_RE } from "../lib/slug";
import { mediaUrl, serialize, toDate } from "../lib/serialize";
import { getSettings, publicSettings } from "../lib/settings";
import { streamMedia } from "./admin/media";

/**
 * Public, read-only API. Returns only published content whose publication date has passed,
 * projected through explicit allow-lists of fields (no internal metadata, no author uids).
 */
const cache: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  next();
};

const byPublishDesc = (a: { data: FirebaseFirestore.DocumentData }, b: { data: FirebaseFirestore.DocumentData }) =>
  (toDate(b.data.publishAt)?.getTime() ?? 0) - (toDate(a.data.publishAt)?.getTime() ?? 0);

const stripBody = (item: Record<string, unknown>) => {
  const { contentHtml: _c, descriptionHtml: _d, ...rest } = item;
  void _c;
  void _d;
  return rest;
};

async function findBySlug(type: ContentType, slug: string) {
  if (!SLUG_RE.test(slug)) throw notFound();
  const snap = await db.collection(type.collection).where("slug", "==", slug).limit(5).get();
  const doc = snap.docs.find((d) => isPubliclyVisible(d.data()));
  if (!doc) throw notFound();
  return doc;
}

function categoriesOf(items: { data: FirebaseFirestore.DocumentData }[]) {
  return [...new Set(items.map((i) => String(i.data.category ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function eventEnd(d: FirebaseFirestore.DocumentData) {
  return (toDate(d.endAt) ?? toDate(d.startAt))?.getTime() ?? 0;
}

export function publicRouter(): Router {
  const r = Router();
  r.use(cache);

  r.get("/settings", async (_req, res) => {
    res.json(publicSettings(await getSettings()));
  });

  r.get("/home", async (_req, res) => {
    const [news, projects, events, processes] = await Promise.all([
      loadPublished(CONTENT_TYPES.news),
      loadPublished(CONTENT_TYPES.projects),
      loadPublished(CONTENT_TYPES.events),
      loadPublished(CONTENT_TYPES.selectionProcesses),
    ]);
    const now = Date.now();
    res.json({
      news: news.sort(byPublishDesc).slice(0, 3).map((n) => stripBody(toPublic(CONTENT_TYPES.news, n.id, n.data))),
      projects: projects.sort(byPublishDesc).slice(0, 3).map((p) => stripBody(toPublic(CONTENT_TYPES.projects, p.id, p.data))),
      events: events
        .filter((e) => eventEnd(e.data) >= now)
        .sort((a, b) => (toDate(a.data.startAt)?.getTime() ?? 0) - (toDate(b.data.startAt)?.getTime() ?? 0))
        .slice(0, 3)
        .map((e) => stripBody(toPublic(CONTENT_TYPES.events, e.id, e.data))),
      openProcess:
        processes
          .filter((p) => p.data.phase === "inscricoes_abertas")
          .map((p) => stripBody(toPublic(CONTENT_TYPES.selectionProcesses, p.id, p.data)))[0] ?? null,
    });
  });

  r.get("/news", async (req, res) => {
    const all = (await loadPublished(CONTENT_TYPES.news, 1000)).sort(byPublishDesc);
    const category = String(req.query.category ?? "").slice(0, 60);
    const q = normaliseSearch(String(req.query.q ?? "").slice(0, 100)).trim();
    const filtered = all
      .filter((n) => !category || n.data.category === category)
      .filter((n) => !q || normaliseSearch(`${n.data.title} ${n.data.summary}`).includes(q));
    const page = paginate(filtered, req.query.page, req.query.pageSize ?? 9, 24);
    res.json({
      ...page,
      items: page.items.map((n) => stripBody(toPublic(CONTENT_TYPES.news, n.id, n.data))),
      categories: categoriesOf(all),
    });
  });

  r.get("/projects", async (req, res) => {
    const all = (await loadPublished(CONTENT_TYPES.projects)).sort(byPublishDesc);
    const category = String(req.query.category ?? "").slice(0, 60);
    res.json({
      items: all.filter((p) => !category || p.data.category === category).map((p) => stripBody(toPublic(CONTENT_TYPES.projects, p.id, p.data))),
      categories: categoriesOf(all),
    });
  });

  r.get("/events", async (req, res) => {
    const all = await loadPublished(CONTENT_TYPES.events);
    const when = String(req.query.when ?? "all");
    const category = String(req.query.category ?? "").slice(0, 60);
    const now = Date.now();
    const start = (d: FirebaseFirestore.DocumentData) => toDate(d.startAt)?.getTime() ?? 0;
    let items = all.filter((e) => !category || e.data.category === category);
    if (when === "upcoming") items = items.filter((e) => eventEnd(e.data) >= now).sort((a, b) => start(a.data) - start(b.data));
    else if (when === "past") items = items.filter((e) => eventEnd(e.data) < now).sort((a, b) => start(b.data) - start(a.data));
    else items = items.sort((a, b) => start(a.data) - start(b.data));
    res.json({
      items: items.map((e) => ({ ...stripBody(toPublic(CONTENT_TYPES.events, e.id, e.data)), isPast: eventEnd(e.data) < now })),
      categories: categoriesOf(all),
    });
  });

  r.get("/team", async (_req, res) => {
    const all = await loadPublished(CONTENT_TYPES.team);
    res.json({
      items: all
        .sort((a, b) => Number(a.data.order ?? 0) - Number(b.data.order ?? 0))
        .map((m) => toPublic(CONTENT_TYPES.team, m.id, m.data)),
    });
  });

  r.get("/selection-processes", async (_req, res) => {
    const all = (await loadPublished(CONTENT_TYPES.selectionProcesses)).sort(byPublishDesc);
    res.json({ items: all.map((p) => stripBody(toPublic(CONTENT_TYPES.selectionProcesses, p.id, p.data))) });
  });

  r.get("/selection-processes/:slug", async (req, res) => {
    const doc = await findBySlug(CONTENT_TYPES.selectionProcesses, req.params.slug);
    const resultsSnap = await db.collection(COLLECTIONS.selectionResults).where("processId", "==", doc.id).get();
    const results = resultsSnap.docs
      .filter((d) => isPubliclyVisible(d.data()))
      .map((d) => {
        const x = d.data();
        return serialize({
          id: d.id,
          type: x.type,
          title: x.title,
          bodyHtml: x.bodyHtml ?? "",
          entries: x.entries ?? [],
          documents: (x.documentMediaIds ?? []).map((id: string) => mediaUrl(id)),
          version: x.version ?? 1,
          publishAt: x.publishAt,
          updatedAt: x.updatedAt,
        });
      })
      .sort((a, b) => String((b as { publishAt: string }).publishAt).localeCompare(String((a as { publishAt: string }).publishAt)));
    res.json({ ...toPublic(CONTENT_TYPES.selectionProcesses, doc.id, doc.data()), results });
  });

  for (const [path, type] of [
    ["news", CONTENT_TYPES.news],
    ["projects", CONTENT_TYPES.projects],
    ["events", CONTENT_TYPES.events],
  ] as const) {
    r.get(`/${path}/:slug`, async (req, res) => {
      const doc = await findBySlug(type, req.params.slug);
      res.json(toPublic(type, doc.id, doc.data()));
    });
  }

  r.get("/sitemap", async (_req, res) => {
    const out: Record<string, { slug: string; updatedAt: unknown }[]> = {};
    for (const key of ["news", "projects", "events", "selectionProcesses"] as const) {
      const items = await loadPublished(CONTENT_TYPES[key], 1000);
      out[key] = items.map((i) => serialize({ slug: i.data.slug, updatedAt: i.data.updatedAt }) as { slug: string; updatedAt: unknown });
    }
    res.json(out);
  });

  r.get("/media/:id", async (req, res) => {
    if (!ID_RE.test(req.params.id)) throw notFound();
    const snap = await db.collection(COLLECTIONS.media).doc(req.params.id).get();
    const d = snap.data();
    if (!d || d.isPublic !== true) throw notFound();
    await streamMedia(res, d, "public, max-age=600, s-maxage=600");
  });

  return r;
}
