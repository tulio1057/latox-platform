export interface SiteSettings {
  siteName: string;
  shortName: string;
  tagline: string;
  description: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutIntro: string;
  historyHtml: string;
  mission: string;
  vision: string;
  values: string[];
  objectives: string[];
  teaching: string;
  research: string;
  extension: string;
  institution: string;
  address: string;
  contactEmail: string;
  privacyEmail: string;
  instagramUrl: string;
  socialLinks: { label: string; url: string }[];
  footerText: string;
  logoMediaId: string | null;
  logoUrl: string | null;
  seoTitle: string;
  seoDescription: string;
  privacyPolicyHtml: string;
  privacyUpdatedAt: string | null;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  contentHtml?: string;
  category: string;
  coverUrl: string | null;
  coverAlt?: string;
  author?: string;
  publishAt: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  descriptionHtml?: string;
  category: string;
  coverUrl: string | null;
  coverAlt?: string;
  responsible?: string[];
  date?: string | null;
  projectStatus: "planejado" | "em_andamento" | "concluido";
  gallery?: string[];
  publishAt: string;
}

export interface EventItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  descriptionHtml?: string;
  category: string;
  coverUrl: string | null;
  coverAlt?: string;
  startAt: string;
  endAt?: string | null;
  location: string;
  schedule?: { time: string; title: string; description?: string }[];
  speakers?: { name: string; role?: string; bio?: string }[];
  registrationUrl?: string | null;
  eventStatus: "agendado" | "adiado" | "cancelado" | "encerrado";
  isPast?: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  position: string;
  group: "presidencia" | "vice_presidencia" | "diretoria" | "coordenacao" | "membros";
  course?: string;
  period?: string;
  bio?: string;
  link?: string | null;
  order: number;
  photoUrl: string | null;
}

export type SelectionPhase =
  | "em_breve"
  | "inscricoes_abertas"
  | "inscricoes_encerradas"
  | "em_analise"
  | "resultado_preliminar"
  | "periodo_recursos"
  | "resultado_final"
  | "finalizado";

export interface SelectionResult {
  id: string;
  type: "preliminar" | "final" | "aprovados" | "classificados" | "comunicado";
  title: string;
  bodyHtml: string;
  entries: { protocol: string; position?: number | null; situation: string }[];
  documents: string[];
  version: number;
  publishAt: string;
  updatedAt: string;
}

export interface SelectionProcess {
  id: string;
  title: string;
  slug: string;
  summary: string;
  descriptionHtml?: string;
  phase: SelectionPhase;
  registrationStart?: string | null;
  registrationEnd?: string | null;
  registrationUrl: string | null;
  requirements?: string[];
  schedule?: { date: string; label: string }[];
  stages?: { title: string; description?: string }[];
  criteria?: string[];
  vacancies?: number | null;
  noticeUrl?: string | null;
  noticeFileUrl?: string | null;
  documents?: { label: string; url: string | null }[];
  publishAt: string;
  results?: SelectionResult[];
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
