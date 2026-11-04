import "server-only";
import type { EventItem, NewsItem, Paged, ProjectItem, SelectionProcess, SiteSettings, TeamMember } from "./types";

const BASE = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:5001/demo-latox/southamerica-east1/api").replace(/\/$/, "");

export class ApiNotFound extends Error {}

/**
 * Server-side fetch of PUBLIC API data. Responses are revalidated every 60 s.
 * Failures degrade to `fallback` so a temporary API outage never breaks rendering.
 */
async function get<T>(path: string, fallback: T, opts: { notFound?: boolean } = {}): Promise<T> {
  try {
    const res = await fetch(`${BASE}/api/v1/public${path}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 && opts.notFound) throw new ApiNotFound(path);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiNotFound) throw err;
    return fallback;
  }
}

const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Liga Acadêmica de Toxicologia",
  shortName: "LATox",
  tagline: "Ciência, saúde e compromisso com a vida.",
  description: "",
  heroTitle: "Conhecimento que protege, ciência que transforma.",
  heroSubtitle: "",
  aboutIntro: "",
  historyHtml: "",
  mission: "",
  vision: "",
  values: [],
  objectives: [],
  teaching: "",
  research: "",
  extension: "",
  institution: "",
  address: "",
  contactEmail: "",
  privacyEmail: "",
  instagramUrl: "",
  socialLinks: [],
  footerText: "",
  logoMediaId: null,
  logoUrl: null,
  seoTitle: "LATox — Liga Acadêmica de Toxicologia",
  seoDescription: "Liga Acadêmica de Toxicologia: ensino, pesquisa e extensão em toxicologia.",
  privacyPolicyHtml: "",
  privacyUpdatedAt: null,
};

export const api = {
  settings: () => get<SiteSettings>("/settings", DEFAULT_SETTINGS),
  home: () =>
    get<{ news: NewsItem[]; projects: ProjectItem[]; events: EventItem[]; openProcess: SelectionProcess | null }>("/home", {
      news: [],
      projects: [],
      events: [],
      openProcess: null,
    }),
  news: (p: { page?: number; category?: string; q?: string }) =>
    get<Paged<NewsItem> & { categories: string[] }>(`/news${qs(p)}`, {
      items: [],
      page: 1,
      pageSize: 9,
      total: 0,
      totalPages: 1,
      categories: [],
    }),
  newsItem: (slug: string) => get<NewsItem | null>(`/news/${encodeURIComponent(slug)}`, null, { notFound: true }),
  projects: (category?: string) =>
    get<{ items: ProjectItem[]; categories: string[] }>(`/projects${qs({ category })}`, { items: [], categories: [] }),
  project: (slug: string) => get<ProjectItem | null>(`/projects/${encodeURIComponent(slug)}`, null, { notFound: true }),
  events: (p: { when?: string; category?: string }) =>
    get<{ items: EventItem[]; categories: string[] }>(`/events${qs(p)}`, { items: [], categories: [] }),
  event: (slug: string) => get<EventItem | null>(`/events/${encodeURIComponent(slug)}`, null, { notFound: true }),
  team: () => get<{ items: TeamMember[] }>("/team", { items: [] }),
  processes: () => get<{ items: SelectionProcess[] }>("/selection-processes", { items: [] }),
  process: (slug: string) =>
    get<SelectionProcess | null>(`/selection-processes/${encodeURIComponent(slug)}`, null, { notFound: true }),
  sitemap: () =>
    get<Record<string, { slug: string; updatedAt: string }[]>>("/sitemap", {
      news: [],
      projects: [],
      events: [],
      selectionProcesses: [],
    }),
};
