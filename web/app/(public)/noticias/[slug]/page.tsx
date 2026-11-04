import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/ui";
import { api, ApiNotFound } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const revalidate = 60;

async function load(slug: string) {
  try {
    return await api.newsItem(slug);
  } catch (e) {
    if (e instanceof ApiNotFound) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const n = await load((await params).slug);
  if (!n) return {};
  return {
    title: n.title,
    description: n.summary,
    openGraph: { type: "article", title: n.title, description: n.summary, publishedTime: n.publishAt, images: n.coverUrl ? [n.coverUrl] : undefined },
  };
}

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const n = await load((await params).slug);
  if (!n) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: n.title,
    description: n.summary,
    datePublished: n.publishAt,
    author: n.author ? { "@type": "Person", name: n.author } : undefined,
  };
  return (
    <section className="section" style={{ paddingTop: 48 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="container article">
        <nav className="breadcrumb" aria-label="Trilha">
          <Link href="/noticias">Notícias</Link> / <span>{n.category}</span>
        </nav>
        <div className="card-meta">
          {n.category && <span className="badge">{n.category}</span>}
          <time dateTime={n.publishAt}>{formatDate(n.publishAt)}</time>
          {n.author && <span>Por {n.author}</span>}
        </div>
        <h1 style={{ marginTop: 14 }}>{n.title}</h1>
        <p className="lead">{n.summary}</p>
        {n.coverUrl && (
          <div className="article-cover">
            <img src={n.coverUrl} alt={n.coverAlt ?? ""} width={1200} height={750} />
          </div>
        )}
        <RichText html={n.contentHtml} />
        <p style={{ marginTop: 48 }}>
          <Link href="/noticias" className="btn btn-outline">
            ← Voltar para notícias
          </Link>
        </p>
      </article>
    </section>
  );
}
