"use client";

import { ProcessView } from "@/components/ProcessView";
import { RichText } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { SelectionProcess, SelectionResult } from "@/lib/types";

const adminMedia = (id: unknown) => (typeof id === "string" && id ? `/api/v1/admin/media/${id}/file` : null);

/** Renders unsaved/draft content with the public styles (admin-only media URLs). */
export function Preview({ tipo, doc, results = [] }: { tipo: string; doc: Record<string, unknown>; results?: SelectionResult[] }) {
  if (tipo === "processos") {
    const p = {
      ...(doc as unknown as SelectionProcess),
      noticeFileUrl: adminMedia(doc.noticeMediaId),
      documents: ((doc.documents as { label: string; mediaId?: string; url?: string }[]) ?? []).map((d) => ({ label: d.label, url: d.url ?? adminMedia(d.mediaId) })),
      results,
    };
    return <ProcessView process={p} />;
  }
  const cover = adminMedia(doc.coverMediaId ?? doc.photoMediaId);
  const html = (doc.contentHtml ?? doc.descriptionHtml) as string | undefined;
  return (
    <article className="article">
      {typeof doc.category === "string" && doc.category && <span className="badge">{doc.category}</span>}
      <h1 style={{ marginTop: 12 }}>{String(doc.title ?? doc.name ?? "")}</h1>
      {typeof doc.startAt === "string" && doc.startAt && <p className="muted">{formatDateTime(new Date(doc.startAt).toISOString())}</p>}
      {typeof doc.summary === "string" && <p className="lead">{doc.summary}</p>}
      {typeof doc.position === "string" && <p className="lead">{doc.position}</p>}
      {cover && (
        <div className="article-cover">
          <img src={cover} alt={String(doc.coverAlt ?? "")} />
        </div>
      )}
      <RichText html={html} />
      {typeof doc.bio === "string" && <p>{doc.bio}</p>}
    </article>
  );
}
