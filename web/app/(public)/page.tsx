import Link from "next/link";
import { Molecule, Sparkle, Sprig, Wave } from "@/components/decor";
import { IconArrow, IconCalendar, IconFlask, IconNews, IconUsers } from "@/components/icons";
import { RegistrationButton } from "@/components/RegistrationCta";
import { PhaseBadge } from "@/components/ProcessView";
import { EmptyState, EventRow, NewsCard, ProjectCard, SectionLink } from "@/components/ui";
import { api } from "@/lib/api";
import { isPlaceholder } from "@/lib/format";

export const revalidate = 60;

const SHORTCUTS = [
  { href: "/projetos", title: "Nossos projetos", text: "Ensino, pesquisa e extensão em toxicologia.", Icon: IconFlask },
  { href: "/eventos", title: "Próximos eventos", text: "Palestras, cursos e atividades acadêmicas.", Icon: IconCalendar },
  { href: "/processo-seletivo", title: "Participe da liga", text: "Editais, cronogramas e resultados.", Icon: IconUsers },
  { href: "/noticias", title: "Últimas notícias", text: "Comunicados, artigos e novidades.", Icon: IconNews },
];

export default async function HomePage() {
  const [s, home] = await Promise.all([api.settings(), api.home()]);
  const [first, ...rest] = s.heroTitle.split(",");

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <Sprig className="hero-deco" size={300} style={{ right: "-60px", top: "-30px", opacity: 0.45 }} />
        <div className="container hero-grid">
          <div>
            {/* Phones: compact emblem + tagline instead of the large arch artwork. */}
            <div className="hero-visual-mobile rise">
              <img src={s.logoUrl ?? "/brand/logo-latox.jpg"} alt={`Logo oficial da ${s.shortName}`} width={76} height={76} />
              <span className="eyebrow">{s.tagline}</span>
            </div>
            <span className="eyebrow rise hero-desktop-eyebrow">{s.tagline}</span>
            <h1 className="rise rise-2">
              {rest.length ? (
                <>
                  {first},<br />
                  <em>{rest.join(",").trim()}</em>
                </>
              ) : (
                s.heroTitle
              )}
            </h1>
            <p className="lead rise rise-3">
              {isPlaceholder(s.heroSubtitle)
                ? "A Liga Acadêmica de Toxicologia une estudantes e professores em torno do estudo dos efeitos de substâncias sobre a saúde e o ambiente — com rigor científico e compromisso social."
                : s.heroSubtitle}
            </p>
            <div className="hero-actions rise rise-3">
              <Link href="/sobre" className="btn btn-primary btn-lg">
                Conheça a LATox <IconArrow />
              </Link>
              <Link href="/processo-seletivo" className="btn btn-outline btn-lg">
                Participe da Liga
              </Link>
            </div>
          </div>
          <div className="hero-visual rise rise-2">
            <div className="hero-ring" aria-hidden="true" />
            <div className="hero-arch">
              <img src={s.logoUrl ?? "/brand/logo-latox.jpg"} alt={`Logo oficial da ${s.shortName}`} width={460} height={575} fetchPriority="high" />
            </div>
            <Molecule className="hero-deco float" size={92} style={{ right: "-34px", top: "8%" }} />
            <div className="hero-badge">
              <strong>Ensino · Pesquisa · Extensão</strong>
              Toxicologia a serviço da vida.
            </div>
            <Sparkle className="hero-deco" size={22} style={{ left: "6%", top: "6%" }} />
          </div>
        </div>
      </section>

      {/* ---------- Shortcuts ---------- */}
      <section aria-label="Atalhos" className="shortcuts" style={{ paddingBottom: 72 }}>
        <div className="container grid grid-4">
          {SHORTCUTS.map(({ href, title, text, Icon }) => (
            <Link key={href} href={href} className="shortcut">
              <Icon className="shortcut-icon" size={40} />
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="shortcut-arrow">
                Acessar <IconArrow size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- About ---------- */}
      <Wave from="var(--cream-100)" to="var(--green-900)" />
      <section className="section section-dark" style={{ paddingTop: 40 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Sobre nós</span>
              <h2>
                Ciência, saúde e <span className="serif-italic">compromisso com a vida.</span>
              </h2>
              <p className="lead">
                {isPlaceholder(s.aboutIntro)
                  ? "Conteúdo institucional em definição pela diretoria da liga."
                  : s.aboutIntro}
              </p>
            </div>
            <Link href="/sobre" className="btn btn-light">
              Nossa história <IconArrow />
            </Link>
          </div>
          <div className="mvv">
            {[
              ["Missão", s.mission],
              ["Visão", s.vision],
              ["Valores", s.values.join(" · ")],
            ].map(([t, v]) => (
              <div className="mvv-item" key={t}>
                <h3>{t}</h3>
                <p>{isPlaceholder(v) ? "Em definição." : v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-3 pillars" style={{ marginTop: 48 }}>
            {[
              ["Ensino", s.teaching],
              ["Pesquisa", s.research],
              ["Extensão", s.extension],
            ].map(([t, v]) => (
              <div className="pillar" key={t} style={{ borderTopColor: "var(--sage-400)" }}>
                <h3>{t}</h3>
                <p>{isPlaceholder(v) ? "Descrição em breve." : v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Wave from="var(--green-900)" to="var(--cream-100)" flip />

      {/* ---------- Selection process highlight ---------- */}
      {home.openProcess && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="container">
            <div className="process-cta">
              <div>
                <PhaseBadge phase={home.openProcess.phase} />
                <h2 style={{ marginTop: 14 }}>Faça parte da LATox!</h2>
                <p>
                  As inscrições para o nosso processo seletivo estão abertas. Conheça o edital, confira os requisitos e
                  realize sua inscrição pelo formulário oficial.
                </p>
                <Link href={`/processo-seletivo/${home.openProcess.slug}`} className="btn btn-outline btn-sm" style={{ color: "var(--cream-100)", borderColor: "var(--sage-400)" }}>
                  Ver edital e requisitos
                </Link>
              </div>
              <RegistrationButton process={home.openProcess} />
            </div>
          </div>
        </section>
      )}

      {/* ---------- Projects ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Projetos</span>
              <h2>Conhecimento em ação</h2>
            </div>
            <SectionLink href="/projetos">Todos os projetos</SectionLink>
          </div>
          {home.projects.length ? (
            <div className="grid grid-3">
              {home.projects.map((p) => (
                <ProjectCard key={p.id} item={p} />
              ))}
            </div>
          ) : (
            <EmptyState title="Projetos em breve">Os projetos da liga serão publicados aqui.</EmptyState>
          )}
        </div>
      </section>

      {/* ---------- Events ---------- */}
      <section className="section section-beige">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Agenda</span>
              <h2>Próximos eventos</h2>
            </div>
            <SectionLink href="/eventos">Agenda completa</SectionLink>
          </div>
          {home.events.length ? (
            <div style={{ display: "grid", gap: 14 }}>
              {home.events.map((e) => (
                <EventRow key={e.id} item={e} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum evento agendado">Acompanhe nossas redes para novidades.</EmptyState>
          )}
        </div>
      </section>

      {/* ---------- News ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Notícias</span>
              <h2>Últimas publicações</h2>
            </div>
            <SectionLink href="/noticias">Ver todas</SectionLink>
          </div>
          {home.news.length ? (
            <div className="grid grid-3">
              {home.news.map((n) => (
                <NewsCard key={n.id} item={n} />
              ))}
            </div>
          ) : (
            <EmptyState title="Sem notícias por enquanto">As publicações da liga aparecerão aqui.</EmptyState>
          )}
        </div>
      </section>
    </>
  );
}
