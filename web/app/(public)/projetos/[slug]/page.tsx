import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/ui";
import { api, ApiNotFound } from "@/lib/api";
import { formatDate, PROJECT_STATUS_LABELS } from "@/lib/format";

export const revalidate = 60;

async function load(slug: string) {
  try {
    return await api.project(slug);
  } catch (e) {
    if (e instanceof ApiNotFound) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return {};
  return { title: p.title, description: p.summary, openGraph: { title: p.title, description: p.summary, images: p.coverUrl ? [p.coverUrl] : undefined } };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  return (
    <section className="section" style={{ paddingTop: 48 }}>
      <div className="container">
        <nav className="breadcrumb" aria-label="Trilha">
          <Link href="/projetos">Projetos</Link> / <span>{p.title}</span>
        </nav>
        <div className="detail-layout">
          <article>
            <div className="card-meta">
              {p.category && <span className="badge">{p.category}</span>}
              <span className="badge badge-muted">{PROJECT_STATUS_LABELS[p.projectStatus]}</span>
            </div>
            <h1 style={{ marginTop: 14 }}>{p.title}</h1>
            <p className="lead">{p.summary}</p>
            {p.coverUrl && (
              <div className="article-cover">
                <img src={p.coverUrl} alt={p.coverAlt ?? ""} width={1200} height={750} />
              </div>
            )}
            <RichText html={p.descriptionHtml} />
            {!!p.gallery?.length && (
              <>
                <h2 style={{ marginTop: 40 }}>Galeria</h2>
                <div className="gallery">
                  {p.gallery.map((src, i) => (
                    <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                      <img src={src} alt={`Imagem ${i + 1} do projeto ${p.title}`} loading="lazy" width={240} height={240} />
                    </a>
                  ))}
                </div>
              </>
            )}
          </article>
          <aside className="detail-aside">
            <dl style={{ margin: 0, display: "grid", gap: 14 }}>
              <div>
                <dt>Status</dt>
                <dd>{PROJECT_STATUS_LABELS[p.projectStatus]}</dd>
              </div>
              {p.date && (
                <div>
                  <dt>Data</dt>
                  <dd>{formatDate(`${p.date}T12:00:00Z`)}</dd>
                </div>
              )}
              {!!p.responsible?.length && (
                <div>
                  <dt>Responsáveis</dt>
                  <dd>{p.responsible.join(", ")}</dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}
