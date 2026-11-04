import type { Metadata } from "next";
import { Wave } from "@/components/decor";
import { PageHero, RichText } from "@/components/ui";
import { api } from "@/lib/api";
import { isPlaceholder } from "@/lib/format";

export const revalidate = 60;
export const metadata: Metadata = { title: "Sobre a LATox", description: "História, missão, visão, valores e áreas de atuação da LATox." };

function Placeholder({ value, fallback = "Conteúdo em definição pela diretoria." }: { value: string; fallback?: string }) {
  return <>{isPlaceholder(value) ? <span className="muted">{fallback}</span> : value}</>;
}

export default async function AboutPage() {
  const s = await api.settings();
  return (
    <>
      <PageHero
        eyebrow="Sobre a LATox"
        title={
          <>
            Toxicologia com <span className="serif-italic">propósito.</span>
          </>
        }
        lead={isPlaceholder(s.aboutIntro) ? s.tagline : s.aboutIntro}
      />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container detail-layout">
          <div>
            <span className="eyebrow">Nossa história</span>
            {isPlaceholder(s.historyHtml) ? (
              <p className="muted">A história da liga será publicada em breve.</p>
            ) : (
              <RichText html={s.historyHtml} />
            )}
          </div>
          <aside className="detail-aside" style={{ background: "var(--beige-200)" }}>
            <img src={s.logoUrl ?? "/brand/logo-latox.jpg"} alt={`Logo oficial da ${s.shortName}`} width={272} height={272} style={{ mixBlendMode: "multiply", borderRadius: 16 }} />
            {!isPlaceholder(s.institution) && <p className="muted mt-0">{s.institution}</p>}
          </aside>
        </div>
      </section>

      <Wave from="var(--cream-100)" to="var(--green-900)" />
      <section className="section section-dark" style={{ paddingTop: 32 }}>
        <div className="container">
          <span className="eyebrow">Missão, visão e valores</span>
          <div className="mvv" style={{ marginTop: 16 }}>
            <div className="mvv-item">
              <h3>Missão</h3>
              <p>
                <Placeholder value={s.mission} />
              </p>
            </div>
            <div className="mvv-item">
              <h3>Visão</h3>
              <p>
                <Placeholder value={s.vision} />
              </p>
            </div>
            <div className="mvv-item">
              <h3>Valores</h3>
              {s.values.filter((v) => !isPlaceholder(v)).length ? (
                <ul className="check-list">
                  {s.values.filter((v) => !isPlaceholder(v)).map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              ) : (
                <p>Em definição.</p>
              )}
            </div>
          </div>
        </div>
      </section>
      <Wave from="var(--green-900)" to="var(--cream-100)" flip />

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Áreas de atuação</span>
              <h2>Ensino, pesquisa e extensão</h2>
            </div>
          </div>
          <div className="grid grid-3 pillars">
            {[
              ["Ensino", s.teaching],
              ["Pesquisa", s.research],
              ["Extensão", s.extension],
            ].map(([t, v]) => (
              <div className="pillar" key={t}>
                <h3>{t}</h3>
                <p>
                  <Placeholder value={v ?? ""} fallback="Descrição em breve." />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-beige">
        <div className="container" style={{ maxWidth: 860 }}>
          <span className="eyebrow">Objetivos</span>
          <h2>Objetivos acadêmicos</h2>
          {s.objectives.filter((o) => !isPlaceholder(o)).length ? (
            <ul className="check-list" style={{ marginTop: 20 }}>
              {s.objectives.filter((o) => !isPlaceholder(o)).map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Os objetivos acadêmicos serão publicados em breve.</p>
          )}
        </div>
      </section>
    </>
  );
}
