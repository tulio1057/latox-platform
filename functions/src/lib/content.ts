import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import type { ZodObject, ZodRawShape } from "zod";
import { COLLECTIONS, db } from "./firebase";
import { mediaUrl, pick, serialize, toDate } from "./serialize";
import { slugify } from "./slug";
import {
  eventSchema,
  newsSchema,
  projectSchema,
  selectionProcessSchema,
  teamSchema,
} from "../routes/admin/schemas";

export type ContentStatus = "draft" | "published" | "archived";

export interface ContentType {
  key: string;
  collection: string;
  resourceType: string;
  schema: ZodObject<ZodRawShape>;
  /** Field the slug is derived from; null if the type has no public detail page. */
  slugSource: "title" | null;
  /** ISO date-time inputs stored as Firestore Timestamps. */
  dateFields: string[];
  publicFields: readonly string[];
  /** Extra public projections (media URLs etc.). */
  decorate?: (doc: DocumentData) => Record<string, unknown>;
}

const cover = (d: DocumentData) => ({ coverUrl: mediaUrl(d.coverMediaId) });

export const CONTENT_TYPES = {
  news: {
    key: "news",
    collection: COLLECTIONS.news,
    resourceType: "news",
    schema: newsSchema as unknown as ZodObject<ZodRawShape>,
    slugSource: "title",
    dateFields: [],
    publicFields: ["title", "slug", "summary", "contentHtml", "category", "coverAlt", "author", "publishAt"],
    decorate: cover,
  },
  projects: {
    key: "projects",
    collection: COLLECTIONS.projects,
    resourceType: "project",
    schema: projectSchema as unknown as ZodObject<ZodRawShape>,
    slugSource: "title",
    dateFields: [],
    publicFields: [
      "title", "slug", "summary", "descriptionHtml", "category", "coverAlt", "responsible", "date", "projectStatus", "publishAt",
    ],
    decorate: (d) => ({
      ...cover(d),
      gallery: (Array.isArray(d.galleryMediaIds) ? d.galleryMediaIds : []).map((id: string) => mediaUrl(id)),
    }),
  },
  events: {
    key: "events",
    collection: COLLECTIONS.events,
    resourceType: "event",
    schema: eventSchema as unknown as ZodObject<ZodRawShape>,
    slugSource: "title",
    dateFields: ["startAt", "endAt"],
    publicFields: [
      "title", "slug", "summary", "descriptionHtml", "category", "coverAlt", "startAt", "endAt", "location",
      "schedule", "speakers", "registrationUrl", "eventStatus", "publishAt",
    ],
    decorate: cover,
  },
  team: {
    key: "team",
    collection: COLLECTIONS.team,
    resourceType: "team_member",
    schema: teamSchema as unknown as ZodObject<ZodRawShape>,
    slugSource: null,
    dateFields: [],
    publicFields: ["name", "position", "group", "course", "period", "bio", "link", "order"],
    decorate: (d) => ({ photoUrl: mediaUrl(d.photoMediaId) }),
  },
  selectionProcesses: {
    key: "selectionProcesses",
    collection: COLLECTIONS.selectionProcesses,
    resourceType: "selection_process",
    schema: selectionProcessSchema as unknown as ZodObject<ZodRawShape>,
    slugSource: "title",
    dateFields: ["registrationStart", "registrationEnd"],
    publicFields: [
      "title", "slug", "summary", "descriptionHtml", "phase", "registrationStart", "registrationEnd",
      "requirements", "schedule", "stages", "criteria", "vacancies", "noticeUrl", "publishAt",
    ],
    decorate: (d) => ({
      noticeFileUrl: mediaUrl(d.noticeMediaId),
      // Registration link is only exposed while registrations are open.
      registrationUrl: d.phase === "inscricoes_abertas" && typeof d.registrationUrl === "string" ? d.registrationUrl : null,
      documents: (Array.isArray(d.documents) ? d.documents : []).map((doc: DocumentData) => ({
        label: doc.label,
        url: doc.url ?? mediaUrl(doc.mediaId),
      })),
    }),
  },
} satisfies Record<string, ContentType>;

export type ContentKey = keyof typeof CONTENT_TYPES;

export function isPubliclyVisible(d: DocumentData, now = Date.now()): boolean {
  const at = toDate(d.publishAt);
  return d.status === "published" && at !== null && at.getTime() <= now;
}

export function toPublic(type: ContentType, id: string, d: DocumentData) {
  return serialize({ id, ...pick(d, type.publicFields), ...(type.decorate?.(d) ?? {}) }) as Record<string, unknown>;
}

/** Converts validated ISO strings to Timestamps for the configured date fields. */
export function normaliseDates(type: ContentType, data: Record<string, unknown>) {
  for (const f of type.dateFields) {
    const v = data[f];
    if (typeof v === "string") data[f] = Timestamp.fromDate(new Date(v));
  }
  return data;
}

export async function uniqueSlug(collection: string, base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const snap = await db.collection(collection).where("slug", "==", candidate).limit(2).get();
    if (snap.docs.every((d) => d.id === excludeId)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Loads all published, currently visible documents of a type (bounded). */
export async function loadPublished(type: ContentType, max = 500) {
  const snap = await db.collection(type.collection).where("status", "==", "published").limit(max).get();
  const now = Date.now();
  return snap.docs.filter((d) => isPubliclyVisible(d.data(), now)).map((d) => ({ id: d.id, data: d.data() }));
}

export async function saveRevision(resourceType: string, resourceId: string, snapshot: DocumentData, by: string, reason: string) {
  await db.collection(COLLECTIONS.revisions).add({
    resourceType,
    resourceId,
    snapshot,
    reason,
    by,
    at: Timestamp.now(),
  });
}

export function paginate<T>(items: T[], pageRaw: unknown, sizeRaw: unknown, maxSize: number) {
  const pageSize = Math.min(Math.max(Number.parseInt(String(sizeRaw ?? "12"), 10) || 12, 1), maxSize);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Number.parseInt(String(pageRaw ?? "1"), 10) || 1, 1), totalPages);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total, totalPages };
}

export function normaliseSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
