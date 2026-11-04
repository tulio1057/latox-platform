import type { SelectionProcess } from "@/lib/types";
import { formatDate, formatDateTime, PHASE_LABELS, RESULT_TYPE_LABELS, safeHref } from "@/lib/format";
import { IconFile } from "./icons";
import { RegistrationButton } from "./RegistrationCta";
import { EmptyState, RichText } from "./ui";

export function PhaseBadge({ phase }: { phase: SelectionProcess["phase"] }) {
  const cls = phase === "inscricoes_abertas" ? "badge-success" : phase === "finalizado" ? "badge-muted" : "badge-warn";
  return <span className={`badge ${cls}`}>{PHASE_LABELS[phase] ?? phase}</span>;
}

/** Full public presentation of one selection process (also used by the admin preview). */
export function ProcessView({ process }: { process: SelectionProcess }) {
  const notice = process.noticeFileUrl ?? safeHref(process.noticeUrl);
  const docs = (process.documents ?? []).filter((d) => d.url);
  return (
    <div className="stack" style={{ display: "grid", gap: 48 }}>
      <div className="process-cta">
        <div>
          <PhaseBadge phase={process.phase} />
          <h2 style={{ marginTop: 14 }}>
            {process.phase === "inscricoes_abertas" ? "Faça parte da LATox!" : process.title}
          </h2>
          <p style={{ maxWidth: "58ch" }}>
            {process.phase === "inscricoes_abertas"
              ? "As inscrições para o nosso processo seletivo estão abertas. Conheça o edital, confira os requisitos e realize sua inscrição pelo formulário oficial."
              : process.summary}
          </p>
          {(process.registrationStart || process.registrationEnd) && (
            <p style={{ fontSize: "0.92rem" }}>
              <strong>Período de inscrição:</strong> {formatDateTime(process.registrationStart)} — {formatDateTime(process.registrationEnd)}
            </p>
          )}
          {notice && (
            <a className="btn btn-outline btn-sm" href={notice} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cream-100)", borderColor: "var(--sage-400)" }}>
              <IconFile /> Ler o edital
            </a>
          )}
        </div>
        <RegistrationButton process={process} />
      </div>

      <div className="detail-layout">
        <div className="stack">
          <RichText html={process.descriptionHtml} />

          {!!process.requirements?.length && (
            <section>
              <h2>Requisitos</h2>
              <ul className="check-list">
                {process.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {!!process.stages?.length && (
            <section>
              <h2>Etapas</h2>
              <ol className="timeline">
                {process.stages.map((s, i) => (
                  <li key={`${s.title}-${i}`}>
                    <strong>Etapa {i + 1}</strong>
                    <h3 style={{ fontSize: "1.3rem", margin: "2px 0" }}>{s.title}</h3>
                    {s.description && <p className="muted">{s.description}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {!!process.criteria?.length && (
            <section>
              <h2>Critérios de seleção</h2>
              <ul className="check-list">
                {process.criteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="detail-aside" aria-label="Resumo do processo">
          <dl style={{ margin: 0, display: "grid", gap: 14 }}>
            <div>
              <dt>Status</dt>
              <dd>
                <PhaseBadge phase={process.phase} />
              </dd>
            </div>
            {process.vacancies != null && (
              <div>
                <dt>Vagas</dt>
                <dd>{process.vacancies}</dd>
              </div>
            )}
          </dl>
          {!!process.schedule?.length && (
            <div>
              <h3 style={{ fontSize: "1.25rem" }}>Cronograma</h3>
              <ol className="timeline">
                {process.schedule.map((s, i) => (
                  <li key={`${s.date}-${i}`}>
                    <strong>{s.date}</strong>
                    {s.label}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {docs.length > 0 && (
            <div>
              <h3 style={{ fontSize: "1.25rem" }}>Documentos</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {docs.map((d) => (
                  <li key={d.url!}>
                    <a href={d.url!} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <IconFile /> {d.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <section aria-labelledby="results-title">
        <h2 id="results-title">Resultados e comunicados</h2>
        {!process.results?.length ? (
          <EmptyState title="Nenhum resultado publicado">Os resultados serão divulgados aqui conforme o cronograma.</EmptyState>
        ) : (
          <div style={{ display: "grid", gap: 28 }}>
            {process.results.map((r) => (
              <article key={r.id} className="card" style={{ padding: 28 }}>
                <div className="card-meta">
                  <span className="badge badge-dark">{RESULT_TYPE_LABELS[r.type] ?? r.type}</span>
                  <span>Publicado em {formatDate(r.publishAt)}</span>
                  {r.version > 1 && <span className="badge badge-warn">Retificado (versão {r.version})</span>}
                </div>
                <h3 style={{ margin: "10px 0" }}>{r.title}</h3>
                <RichText html={r.bodyHtml} />
                {r.entries.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: 16 }}>
                    <table className="table">
                      <caption className="sr-only">{r.title}</caption>
                      <thead>
                        <tr>
                          {r.entries.some((e) => e.position != null) && <th scope="col">Posição</th>}
                          <th scope="col">Nº de inscrição / protocolo</th>
                          <th scope="col">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.entries.map((e) => (
                          <tr key={e.protocol}>
                            {r.entries.some((x) => x.position != null) && <td>{e.position ?? "—"}</td>}
                            <td>{e.protocol}</td>
                            <td>{e.situation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {r.documents.length > 0 && (
                  <p style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {r.documents.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                        <IconFile /> Documento {i + 1} (PDF)
                      </a>
                    ))}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
