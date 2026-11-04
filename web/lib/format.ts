import type { EventItem, ProjectItem, SelectionPhase, SelectionResult, TeamMember } from "./types";

const TZ = "America/Sao_Paulo";

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opts }).format(d);
}

export const formatDateTime = (iso: string | null | undefined) =>
  formatDate(iso, { dateStyle: "long", timeStyle: "short" });

export const formatTime = (iso: string | null | undefined) => formatDate(iso, { hour: "2-digit", minute: "2-digit" });

export function dayMonth(iso: string) {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit" }).format(d),
    month: new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, month: "short" }).format(d).replace(".", ""),
  };
}

export const PHASE_LABELS: Record<SelectionPhase, string> = {
  em_breve: "Em breve",
  inscricoes_abertas: "Inscrições abertas",
  inscricoes_encerradas: "Inscrições encerradas",
  em_analise: "Em análise",
  resultado_preliminar: "Resultado preliminar publicado",
  periodo_recursos: "Período de recursos",
  resultado_final: "Resultado final publicado",
  finalizado: "Processo finalizado",
};

export const PROJECT_STATUS_LABELS: Record<ProjectItem["projectStatus"], string> = {
  planejado: "Planejado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export const EVENT_STATUS_LABELS: Record<EventItem["eventStatus"], string> = {
  agendado: "Agendado",
  adiado: "Adiado",
  cancelado: "Cancelado",
  encerrado: "Encerrado",
};

export const TEAM_GROUP_LABELS: Record<TeamMember["group"], string> = {
  presidencia: "Presidência",
  vice_presidencia: "Vice-presidência",
  diretoria: "Diretoria",
  coordenacao: "Coordenação",
  membros: "Membros",
};

export const RESULT_TYPE_LABELS: Record<SelectionResult["type"], string> = {
  preliminar: "Resultado preliminar",
  final: "Resultado final",
  aprovados: "Lista de aprovados",
  classificados: "Lista de classificados",
  comunicado: "Comunicado",
};

export const isPlaceholder = (value: string | null | undefined) => !value || value.includes("[PREENCHER]");

/** Defence in depth for links rendered from CMS data: only https/mailto, else null. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && !u.username && !u.password) return u.toString();
    if (u.protocol === "mailto:") return u.toString();
  } catch {
    /* invalid */
  }
  return null;
}
