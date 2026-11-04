import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, NewsCard, PageHero, Pagination } from "@/components/ui";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Notícias", description: "Notícias, artigos e comunicados da LATox." };

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const category = typeof sp.categoria === "string" ? sp.categoria.slice(0, 60) : "";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const page = Math.max(1, Number.parseInt(String(sp.pagina ?? "1"), 10) || 1);
  const data = await api.news({ page, category, q });

  const href = (p: { categoria?: string; q?: string; pagina?: number }) => {
    const s = new URLSearchParams();
    if (p.categoria) s.set("categoria", p.categoria);
    if (p.q) s.set("q", p.q);
    if (p.pagina && p.pagina > 1) s.set("pagina", String(p.pagina));
    const out = s.toString();
    return out ? `/noticias?${out}` : "/noticias";
  };

  return (
    <>
      <PageHero eyebrow="Publicações" title="Notícias" lead="Acompanhe as novidades, artigos e comunicados da liga." />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="filters">
            <nav aria-label="Filtrar por categoria" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="chip" href={href({ q })} aria-current={!category ? "true" : undefined}>
                Todas
              </Link>
              {data.categories.map((c) => (
                <Link key={c} className="chip" href={href({ categoria: c, q })} aria-current={c === category ? "true" : undefined}>
                  {c}
                </Link>
              ))}
            </nav>
            <form className="search-form" role="search" action="/noticias">
              {category && <input type="hidden" name="categoria" value={category} />}
              <label htmlFor="busca" className="sr-only">
                Buscar notícias
              </label>
              <input id="busca" className="input" type="search" name="q" defaultValue={q} placeholder="Buscar notícias…" maxLength={100} />
              <button className="btn btn-primary" type="submit">
                Buscar
              </button>
            </form>
          </div>
          {q && (
            <p className="muted" role="status">
              {data.total} resultado(s) para “{q}”.
            </p>
          )}
          {data.items.length ? (
            <div className="grid grid-3">
              {data.items.map((n) => (
                <NewsCard key={n.id} item={n} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma notícia encontrada">{q || category ? "Tente outros termos ou categorias." : "As publicações aparecerão aqui."}</EmptyState>
          )}
          <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(p) => href({ categoria: category, q, pagina: p })} />
        </div>
      </section>
    </>
  );
}
