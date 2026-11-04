import type { Metadata } from "next";
import { EmptyState, PageHero } from "@/components/ui";
import { api } from "@/lib/api";
import { safeHref, TEAM_GROUP_LABELS } from "@/lib/format";
import type { TeamMember } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = { title: "Equipe", description: "Conheça os integrantes da LATox." };

const ORDER: TeamMember["group"][] = ["presidencia", "vice_presidencia", "diretoria", "coordenacao", "membros"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default async function TeamPage() {
  const { items } = await api.team();
  return (
    <>
      <PageHero eyebrow="Equipe" title="Quem faz a LATox" lead="Estudantes e docentes unidos pela toxicologia." />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ display: "grid", gap: 64 }}>
          {items.length === 0 && <EmptyState title="Equipe em atualização">Os integrantes serão apresentados em breve.</EmptyState>}
          {ORDER.map((group) => {
            const members = items.filter((m) => m.group === group);
            if (!members.length) return null;
            return (
              <section key={group} aria-labelledby={`g-${group}`}>
                <h2 id={`g-${group}`}>{TEAM_GROUP_LABELS[group]}</h2>
                <div className="grid grid-4" style={{ marginTop: 20 }}>
                  {members.map((m) => {
                    const link = safeHref(m.link);
                    return (
                      <article key={m.id} className="member">
                        <div className="member-photo">
                          {m.photoUrl ? <img src={m.photoUrl} alt={`Foto de ${m.name}`} loading="lazy" width={132} height={132} /> : <span aria-hidden="true">{initials(m.name)}</span>}
                        </div>
                        <h3>{m.name}</h3>
                        <div className="role">{m.position}</div>
                        {(m.course || m.period) && (
                          <div className="card-meta" style={{ justifyContent: "center", marginTop: 4 }}>
                            {[m.course, m.period].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {m.bio && <p>{m.bio}</p>}
                        {link && (
                          <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: "0.88rem" }}>
                            Perfil profissional
                          </a>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </>
  );
}
