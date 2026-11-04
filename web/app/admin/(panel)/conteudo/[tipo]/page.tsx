"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { admin, errorMessage } from "@/lib/admin-api";
import { CONTENT_TYPES } from "@/lib/admin-config";
import { formatDateTime } from "@/lib/format";

interface Row {
  id: string;
  title?: string;
  name?: string;
  status: "draft" | "published" | "archived";
  publishAt: string | null;
  updatedAt: string;
  category?: string;
  group?: string;
  phase?: string;
}

export default function ContentListPage() {
  const { tipo } = useParams<{ tipo: string }>();
  const cfg = CONTENT_TYPES[tipo];
  const { can, toast } = useAdmin();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    if (!cfg) return;
    try {
      const s = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (status) s.set("status", status);
      if (q) s.set("q", q);
      const r = await admin.get<{ items: Row[]; totalPages: number }>(`/${cfg.api}?${s}`);
      setRows(r.items);
      setTotalPages(r.totalPages);
    } catch (e) {
      toast("error", errorMessage(e));
      setRows([]);
    }
  }, [cfg, page, status, q, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!cfg) notFound();

  return (
    <>
      <div className="admin-page-head">
        <h1>{cfg.label}</h1>
        {can("content:write") && (
          <Link href={`/admin/conteudo/${tipo}/novo`} className="btn btn-primary">
            + Novo {cfg.singular}
          </Link>
        )}
      </div>
      <div className="panel">
        <form
          className="toolbar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void load();
          }}
        >
          <label className="sr-only" htmlFor="flt-status">
            Filtrar por status
          </label>
          <select id="flt-status" className="select" style={{ width: "auto" }} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">Todos os status</option>
            <option value="draft">Rascunhos</option>
            <option value="published">Publicados</option>
            <option value="archived">Arquivados</option>
          </select>
          <label className="sr-only" htmlFor="flt-q">
            Buscar
          </label>
          <input id="flt-q" className="input" style={{ maxWidth: 320 }} placeholder="Buscar por título…" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-outline btn-sm" type="submit">
            Buscar
          </button>
        </form>
      </div>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{cfg.titleField === "name" ? "Nome" : "Título"}</th>
              <th scope="col">Status</th>
              <th scope="col">Atualizado</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={4} role="status">
                  Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  Nenhum item encontrado.{" "}
                  {can("content:write") && <Link href={`/admin/conteudo/${tipo}/novo`}>Criar o primeiro</Link>}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/conteudo/${tipo}/${r.id}`} style={{ fontWeight: 600 }}>
                      {r.title ?? r.name}
                    </Link>
                    {(r.category || r.group) && <div className="muted" style={{ fontSize: "0.8rem" }}>{r.category || r.group}</div>}
                  </td>
                  <td>
                    <StatusBadge status={r.status} publishAt={r.publishAt} />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.updatedAt)}</td>
                  <td>
                    <Link href={`/admin/conteudo/${tipo}/${r.id}`} className="btn btn-ghost btn-sm">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button className="chip" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="chip" aria-current="true">
            {page} / {totalPages}
          </span>
          <button className="chip" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima →
          </button>
        </div>
      )}
    </>
  );
}
