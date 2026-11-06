import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero, ProjectCard } from "@/components/ui";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Projetos", description: "Projetos de ensino, pesquisa e extensão da LATox." };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const category = typeof categoria === "string" ? categoria.slice(0, 60) : undefined;
  const { items, categories } = await api.projects(category);
  return (
    <>
      <PageHero eyebrow="Projetos" title="Projetos da liga" lead="Iniciativas de ensino, pesquisa e extensão desenvolvidas pela LATox." />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {categories.length > 0 && (
            <nav className="filters chip-row" aria-label="Filtrar por categoria">
              <Link className="chip" href="/projetos" aria-current={!category ? "true" : undefined}>
                Todos
              </Link>
              {categories.map((c) => (
                <Link key={c} className="chip" href={`/projetos?categoria=${encodeURIComponent(c)}`} aria-current={c === category ? "true" : undefined}>
                  {c}
                </Link>
              ))}
            </nav>
          )}
          {items.length ? (
            <div className="grid grid-3">
              {items.map((p) => (
                <ProjectCard key={p.id} item={p} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum projeto encontrado">{category ? "Tente outra categoria." : "Os projetos serão publicados em breve."}</EmptyState>
          )}
        </div>
      </section>
    </>
  );
}
