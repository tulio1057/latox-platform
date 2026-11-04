import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconExternal } from "@/components/icons";
import { RichText } from "@/components/ui";
import { api, ApiNotFound } from "@/lib/api";
import { EVENT_STATUS_LABELS, formatDateTime, safeHref } from "@/lib/format";

export const revalidate = 60;

async function load(slug: string) {
  try {
    return await api.event(slug);
  } catch (e) {
    if (e instanceof ApiNotFound) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await load((await params).slug);
  if (!e) return {};
  return { title: e.title, description: e.summary, openGraph: { title: e.title, description: e.summary, images: e.coverUrl ? [e.coverUrl] : undefined } };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const e = await load((await params).slug);
  if (!e) notFound();
  const end = e.endAt ?? e.startAt;
  const isPast = new Date(end).getTime() < Date.now();
  const registration = !isPast && e.eventStatus === "agendado" ? safeHref(e.registrationUrl) : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    description: e.summary,
    startDate: e.startAt,
    endDate: e.endAt ?? undefined,
    eventStatus: e.eventStatus === "cancelado" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    location: e.location ? { "@type": "Place", name: e.location } : undefined,
  };
  return (
    <section className="section" style={{ paddingTop: 48 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container">
        <nav className="breadcrumb" aria-label="Trilha">
          <Link href="/eventos">Eventos</Link> / <span>{e.title}</span>
        </nav>
        <div className="detail-layout">
          <article>
            <div className="card-meta">
              {e.category && <span className="badge">{e.category}</span>}
              {isPast ? <span className="badge badge-muted">Evento encerrado</span> : <span className="badge badge-success">{EVENT_STATUS_LABELS[e.eventStatus]}</span>}
            </div>
            <h1 style={{ marginTop: 14 }}>{e.title}</h1>
            <p className="lead">{e.summary}</p>
            {e.coverUrl && (
              <div className="article-cover">
                <img src={e.coverUrl} alt={e.coverAlt ?? ""} width={1200} height={750} />
              </div>
            )}
            <RichText html={e.descriptionHtml} />
            {!!e.schedule?.length && (
              <section style={{ marginTop: 40 }}>
                <h2>Programação</h2>
                <ol className="timeline">
                  {e.schedule.map((s, i) => (
                    <li key={i}>
                      <strong>{s.time}</strong>
                      <span style={{ fontWeight: 600 }}>{s.title}</span>
                      {s.description && <p className="muted mt-0">{s.description}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {!!e.speakers?.length && (
              <section style={{ marginTop: 40 }}>
                <h2>Palestrantes</h2>
                <div className="grid grid-2">
                  {e.speakers.map((sp) => (
                    <div key={sp.name} className="card" style={{ padding: 22 }}>
                      <h3 style={{ marginBottom: 2 }}>{sp.name}</h3>
                      {sp.role && <div className="muted">{sp.role}</div>}
                      {sp.bio && <p style={{ marginTop: 8 }}>{sp.bio}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </article>
          <aside className="detail-aside">
            <dl style={{ margin: 0, display: "grid", gap: 14 }}>
              <div>
                <dt>Início</dt>
                <dd>{formatDateTime(e.startAt)}</dd>
              </div>
              {e.endAt && (
                <div>
                  <dt>Término</dt>
                  <dd>{formatDateTime(e.endAt)}</dd>
                </div>
              )}
              {e.location && (
                <div>
                  <dt>Local</dt>
                  <dd>{e.location}</dd>
                </div>
              )}
            </dl>
            {registration && (
              <>
                <a className="btn btn-primary" href={registration} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                  Inscrever-se <IconExternal />
                </a>
                <p className="muted mt-0" style={{ fontSize: "0.82rem" }}>
                  A inscrição é feita em uma plataforma externa.
                </p>
              </>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
