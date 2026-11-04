"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { admin, errorMessage } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";

interface Log {
  id: string;
  at: string;
  actorEmail: string | null;
  actorUid: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  result: "success" | "failure" | "denied";
  meta: Record<string, unknown>;
}

function AuditInner() {
  const { can, toast } = useAdmin();
  const params = useSearchParams();
  const actorUid = params.get("actorUid") ?? "";
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Log[]; totalPages: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (action) s.set("action", action);
      if (actorUid) s.set("actorUid", actorUid);
      setData(await admin.get(`/audit?${s}`));
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }, [page, action, actorUid, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can("audit:read")) return <div className="alert alert-error">Acesso restrito.</div>;

  return (
    <>
      <div className="admin-page-head">
        <h1>Auditoria</h1>
      </div>
      <div className="panel">
        <div className="toolbar">
          <label className="sr-only" htmlFor="flt-action">
            Tipo de ação
          </label>
          <select id="flt-action" className="select" style={{ width: "auto" }} value={action} onChange={(e) => (setAction(e.target.value), setPage(1))}>
            <option value="">Todas as ações</option>
            <option value="auth.">Autenticação</option>
            <option value="authz.">Acessos negados</option>
            <option value="user.">Administradores</option>
            <option value="result.">Resultados</option>
            <option value="selection_process.">Processos seletivos</option>
            <option value="news.">Notícias</option>
            <option value="media.">Arquivos</option>
            <option value="settings.">Configurações</option>
          </select>
          {actorUid && <span className="badge">Filtrando por usuário</span>}
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Data/hora</th>
              <th scope="col">Responsável</th>
              <th scope="col">Ação</th>
              <th scope="col">Recurso</th>
              <th scope="col">Resultado</th>
              <th scope="col">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr>
                <td colSpan={6}>Carregando…</td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>Nenhum registro.</td>
              </tr>
            ) : (
              data.items.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(l.at)}</td>
                  <td>{l.actorEmail ?? "—"}</td>
                  <td>
                    <code>{l.action}</code>
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {l.resourceType ?? "—"}
                    {l.resourceId && <div className="muted">{l.resourceId}</div>}
                  </td>
                  <td>
                    <span className={`badge ${l.result === "success" ? "badge-success" : l.result === "denied" ? "badge-danger" : "badge-warn"}`}>{l.result}</span>
                  </td>
                  <td style={{ fontSize: "0.78rem" }}>
                    {Object.entries(l.meta ?? {})
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" · ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 1 && (
        <div className="pagination">
          <button className="chip" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="chip" aria-current="true">
            {page} / {data.totalPages}
          </span>
          <button className="chip" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima →
          </button>
        </div>
      )}
      <p className="muted" style={{ fontSize: "0.8rem", marginTop: 12 }}>
        Registros de auditoria não podem ser alterados ou excluídos pelo painel. Os registros entram nos backups semanais.
      </p>
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense>
      <AuditInner />
    </Suspense>
  );
}
