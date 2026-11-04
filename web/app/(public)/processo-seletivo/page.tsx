import type { Metadata } from "next";
import Link from "next/link";
import { IconArrow } from "@/components/icons";
import { PhaseBadge } from "@/components/ProcessView";
import { RegistrationButton } from "@/components/RegistrationCta";
import { EmptyState, PageHero } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Processo Seletivo",
  description: "Processos seletivos da LATox: editais, requisitos, cronogramas e resultados.",
};

export default async function SelectionPage() {
  const { items } = await api.processes();
  const current = items.filter((p) => p.phase !== "finalizado");
  const previous = items.filter((p) => p.phase === "finalizado");
  return (
    <>
      <PageHero
        eyebrow="Processo Seletivo"
        title={
          <>
            Faça parte da <span className="serif-italic">LATox</span>
          </>
        }
        lead="Confira os editais, requisitos e cronogramas. As inscrições são realizadas pelo formulário oficial indicado em cada processo."
      />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ display: "grid", gap: 56 }}>
          <section aria-labelledby="atuais">
            <h2 id="atuais">Processos em andamento</h2>
            {current.length ? (
              <div style={{ display: "grid", gap: 20 }}>
                {current.map((p) => (
                  <article key={p.id} className="process-cta">
                    <div>
                      <PhaseBadge phase={p.phase} />
                      <h3 style={{ marginTop: 12, fontSize: "2rem" }}>{p.title}</h3>
                      <p>{p.summary}</p>
                      <Link href={`/processo-seletivo/${p.slug}`} className="btn btn-outline btn-sm" style={{ color: "var(--cream-100)", borderColor: "var(--sage-400)" }}>
                        Edital, requisitos e resultados <IconArrow size={14} />
                      </Link>
                    </div>
                    <RegistrationButton process={p} />
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum processo seletivo aberto no momento">Acompanhe esta página e nossas redes sociais para o próximo edital.</EmptyState>
            )}
          </section>

          {previous.length > 0 && (
            <section aria-labelledby="anteriores">
              <h2 id="anteriores">Processos anteriores</h2>
              <div className="grid grid-3">
                {previous.map((p) => (
                  <article key={p.id} className="card">
                    <div className="card-body">
                      <div className="card-meta">
                        <PhaseBadge phase={p.phase} />
                        <span>{formatDate(p.publishAt)}</span>
                      </div>
                      <h3>
                        <Link href={`/processo-seletivo/${p.slug}`}>{p.title}</Link>
                      </h3>
                      <p>{p.summary}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </>
  );
}
