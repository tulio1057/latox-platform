export const STATUS_LABEL: Record<string, string> = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };

export function StatusBadge({ status, publishAt }: { status: string; publishAt?: string | null }) {
  const scheduled = status === "published" && publishAt && new Date(publishAt).getTime() > Date.now();
  const cls = scheduled ? "badge-warn" : status === "published" ? "badge-success" : status === "archived" ? "badge-muted" : "badge";
  return <span className={`badge status-pill ${cls}`}>{scheduled ? "Agendado" : (STATUS_LABEL[status] ?? status)}</span>;
}
