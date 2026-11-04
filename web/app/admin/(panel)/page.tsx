"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { admin, errorMessage } from "@/lib/admin-api";
import { formatDateTime, PHASE_LABELS } from "@/lib/format";
import type { SelectionPhase } from "@/lib/types";

interface Dashboard {
  totals: { news: number; projects: number; drafts: number; publishedResults: number; activeProcesses: number };
  upcomingEvents: { id: string; title: string; startAt: string; status: string }[];
  activeProcesses: { id: string; title: string; phase: SelectionPhase }[];
  activity: { action: string; actorEmail: string | null; resourceType: string | null; result: string; at: string }[];
}

export default function DashboardPage() {
  const { me, toast } = useAdmin();
  const [data, setData] = useState<Dashboard | null>(null);
  useEffect(() => {
    admin.get<Dashboard>("/dashboard").then(setData).catch((e) => toast("error", errorMessage(e)));
  }, [toast]);

  return (
    <>
      <div className="admin-page-head">
        <div>
          <h1>Olá, {me.name.split(" ")[0] || "administrador(a)"}</h1>
          <p className="muted mt-0">Visão geral do conteúdo da LATox.</p>
        </div>
      </div>
      {!data ? (
        <p role="status">Carregando…</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat">
              <strong>{data.totals.news}</strong>
              <span>Notícias</span>
            </div>
            <div className="stat">
              <strong>{data.totals.projects}</strong>
              <span>Projetos</span>
            </div>
            <div className="stat">
              <strong>{data.upcomingEvents.length}</strong>
              <span>Próximos eventos</span>
            </div>
            <div className="stat">
              <strong>{data.totals.activeProcesses}</strong>
              <span>Processos seletivos ativos</span>
            </div>
            <div className="stat">
              <strong>{data.totals.publishedResults}</strong>
              <span>Resultados publicados</span>
            </div>
            <div className="stat">
              <strong>{data.totals.drafts}</strong>
              <span>Conteúdos em rascunho</span>
            </div>
          </div>
          <div className="form-2col">
            <section className="panel" style={{ marginTop: 0 }}>
              <h2>Próximos eventos</h2>
              {data.upcomingEvents.length ? (
                <ul className="list-stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {data.upcomingEvents.map((e) => (
                    <li key={e.id} className="list-item">
                      <Link href={`/admin/conteudo/eventos/${e.id}`}>{e.title}</Link>
                      <StatusBadge status={e.status} />
                      <span className="muted" style={{ fontSize: "0.82rem" }}>
                        {formatDateTime(e.startAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nenhum evento futuro cadastrado.</p>
              )}
            </section>
            <section className="panel" style={{ marginTop: 0 }}>
              <h2>Processos seletivos ativos</h2>
              {data.activeProcesses.length ? (
                <ul className="list-stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {data.activeProcesses.map((p) => (
                    <li key={p.id} className="list-item">
                      <Link href={`/admin/conteudo/processos/${p.id}`}>{p.title}</Link>
                      <span className="badge">{PHASE_LABELS[p.phase]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nenhum processo publicado em andamento.</p>
              )}
            </section>
          </div>
          <section className="panel">
            <h2>Últimas atividades</h2>
            {data.activity.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Quando</th>
                      <th scope="col">Quem</th>
                      <th scope="col">Ação</th>
                      <th scope="col">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activity.map((a, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(a.at)}</td>
                        <td>{a.actorEmail ?? "—"}</td>
                        <td>
                          <code>{a.action}</code>
                        </td>
                        <td>{a.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Sem atividades registradas.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
