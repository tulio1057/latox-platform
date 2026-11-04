import Link from "next/link";
import type { ReactNode } from "react";
import type { EventItem, NewsItem, ProjectItem } from "@/lib/types";
import { dayMonth, EVENT_STATUS_LABELS, formatDate, formatTime, PROJECT_STATUS_LABELS } from "@/lib/format";
import { IconArrow, IconFlask, IconPin } from "./icons";
import { Molecule, Sprig } from "./decor";

export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="page-hero">
      <Sprig className="page-hero-deco" size={420} />
      <div className="container">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="rise">{title}</h1>
        {lead && <p className="lead rise rise-2">{lead}</p>}
        {children}
      </div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      <Molecule size={64} />
      <h3>{title}</h3>
      {children && <p className="mt-0">{children}</p>}
    </div>
  );
}

/**
 * Renders HTML that was sanitised by the API with a strict allow-list
 * (see functions/src/lib/sanitize.ts) before being stored.
 */
export function RichText({ html }: { html?: string | null }) {
  if (!html) return null;
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Cover({ src, alt }: { src: string | null; alt?: string }) {
  return (
    <div className="card-media">
      {src ? (
        <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" width={640} height={400} />
      ) : (
        <div className="card-media-placeholder">
          <Molecule size={72} />
        </div>
      )}
    </div>
  );
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="card">
      <Cover src={item.coverUrl} alt={item.coverAlt} />
      <div className="card-body">
        <div className="card-meta">
          {item.category && <span className="badge">{item.category}</span>}
          <time dateTime={item.publishAt}>{formatDate(item.publishAt)}</time>
        </div>
        <h3>
          <Link href={`/noticias/${item.slug}`}>{item.title}</Link>
        </h3>
        <p>{item.summary}</p>
        {item.author && <div className="card-meta">Por {item.author}</div>}
      </div>
    </article>
  );
}

export function ProjectCard({ item }: { item: ProjectItem }) {
  return (
    <article className="card">
      <Cover src={item.coverUrl} alt={item.coverAlt} />
      <div className="card-body">
        <div className="card-meta">
          {item.category && <span className="badge">{item.category}</span>}
          <span className="badge badge-muted">{PROJECT_STATUS_LABELS[item.projectStatus] ?? item.projectStatus}</span>
        </div>
        <h3>
          <Link href={`/projetos/${item.slug}`}>{item.title}</Link>
        </h3>
        <p>{item.summary}</p>
      </div>
    </article>
  );
}

export function EventRow({ item }: { item: EventItem }) {
  const { day, month } = dayMonth(item.startAt);
  return (
    <article className={`event-row${item.isPast ? " is-past" : ""}`}>
      <div className="event-date" aria-hidden="true">
        <strong>{day}</strong>
        <span>{month}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="card-meta">
          {item.category && <span className="badge">{item.category}</span>}
          {item.isPast ? (
            <span className="badge badge-muted">Encerrado</span>
          ) : (
            item.eventStatus !== "agendado" && (
              <span className={`badge ${item.eventStatus === "cancelado" ? "badge-danger" : "badge-warn"}`}>
                {EVENT_STATUS_LABELS[item.eventStatus]}
              </span>
            )
          )}
        </div>
        <h3 style={{ margin: "6px 0 4px" }}>
          <Link href={`/eventos/${item.slug}`}>{item.title}</Link>
        </h3>
        <div className="card-meta">
          <time dateTime={item.startAt}>
            {formatDate(item.startAt)} · {formatTime(item.startAt)}
          </time>
          {item.location && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconPin size={15} /> {item.location}
            </span>
          )}
        </div>
      </div>
      <IconArrow />
    </article>
  );
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="btn btn-outline">
      {children} <IconArrow />
    </Link>
  );
}

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginação">
      {page > 1 && (
        <Link className="chip" href={hrefFor(page - 1)} rel="prev">
          ← Anterior
        </Link>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <Link key={p} className="chip" href={hrefFor(p)} aria-current={p === page ? "true" : undefined} aria-label={`Página ${p}`}>
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link className="chip" href={hrefFor(page + 1)} rel="next">
          Próxima →
        </Link>
      )}
    </nav>
  );
}

export function FlaskBadge() {
  return <IconFlask size={20} />;
}
