"use client";

import { useCallback, useEffect, useState } from "react";
import { admin, errorMessage } from "@/lib/admin-api";
import { RESULT_TYPES } from "@/lib/admin-config";
import { formatDateTime, RESULT_TYPE_LABELS } from "@/lib/format";
import type { SelectionResult } from "@/lib/types";
import { useAdmin } from "./AdminProvider";
import { Field } from "./FormFields";
import { StatusBadge } from "./StatusBadge";

interface AdminResult extends SelectionResult {
  status: string;
  documentMediaIds?: string[];
}

interface Draft {
  id?: string;
  type: string;
  title: string;
  bodyHtml: string;
  entriesText: string;
  documentMediaIds: string[];
}

const empty: Draft = { type: "preliminar", title: "", bodyHtml: "", entriesText: "", documentMediaIds: [] };

/** "protocolo;posição;situação" per line → entries. Only protocol numbers, never names/CPF. */
export function parseEntries(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;\t]/).map((p) => p.trim());
      if (parts.length === 2) return { protocol: parts[0]!, situation: parts[1]! };
      const pos = Number.parseInt(parts[1] ?? "", 10);
      return { protocol: parts[0]!, position: Number.isFinite(pos) ? pos : null, situation: parts[2] ?? "" };
    });
}

const entriesToText = (e: SelectionResult["entries"]) =>
  e.map((x) => (x.position != null ? `${x.protocol};${x.position};${x.situation}` : `${x.protocol};${x.situation}`)).join("\n");

export function ResultsManager({ processId, onChange }: { processId: string; onChange?: (r: SelectionResult[]) => void }) {
  const { can, toast, confirm } = useAdmin();
  const [items, setItems] = useState<AdminResult[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await admin.get<{ items: AdminResult[] }>(`/selection-processes/${processId}/results`);
      setItems(r.items);
      onChange?.(r.items.filter((i) => i.status === "published").map((i) => ({ ...i, documents: (i.documentMediaIds ?? []).map((id) => `/api/v1/admin/media/${id}/file`) })));
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }, [processId, toast, onChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const body = {
        type: draft.type,
        title: draft.title,
        bodyHtml: draft.bodyHtml,
        entries: parseEntries(draft.entriesText),
        documentMediaIds: draft.documentMediaIds,
      };
      const live = items.find((i) => i.id === draft.id)?.status === "published";
      if (live) {
        const ok = await confirm({
          title: "Substituir resultado publicado?",
          body: "A alteração ficará visível imediatamente, será marcada como retificação e registrada na auditoria. A versão anterior é preservada no histórico.",
          confirmLabel: "Confirmar substituição",
          danger: true,
        });
        if (!ok) return;
      }
      if (draft.id) await admin.patch(`/results/${draft.id}`, body);
      else await admin.post(`/selection-processes/${processId}/results`, body);
      toast("success", "Resultado salvo.");
      setDraft(null);
      await load();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function publish(r: AdminResult) {
    const ok = await confirm({
      title: "Publicar resultado?",
      body: (
        <div>
          <p>
            <strong>{r.title}</strong> — {r.entries.length} registro(s).
          </p>
          <p>Confirmo que revisei o conteúdo e que ele identifica candidatos apenas pelo número de inscrição/protocolo, sem dados pessoais (CPF, e-mail, telefone).</p>
        </div>
      ),
      confirmLabel: "Revisei e quero publicar",
    });
    if (!ok) return;
    try {
      await admin.post(`/results/${r.id}/publish`, { confirm: true });
      toast("success", "Resultado publicado.");
      await load();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  async function act(r: AdminResult, kind: "unpublish" | "delete") {
    const ok = await confirm({
      title: kind === "delete" ? "Excluir resultado?" : "Despublicar resultado?",
      body: kind === "delete" ? "O resultado será removido. Uma cópia fica no histórico de revisões." : "O resultado deixará de aparecer no site.",
      danger: kind === "delete",
      confirmLabel: kind === "delete" ? "Excluir" : "Despublicar",
    });
    if (!ok) return;
    try {
      if (kind === "delete") await admin.del(`/results/${r.id}`);
      else await admin.post(`/results/${r.id}/unpublish`, {});
      toast("success", "Feito.");
      await load();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  return (
    <section className="panel" aria-labelledby="results-h">
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <h2 id="results-h" style={{ margin: 0 }}>
          Resultados e comunicados
        </h2>
        <span className="spacer" />
        {can("results:write") && !draft && (
          <button className="btn btn-primary btn-sm" onClick={() => setDraft({ ...empty })}>
            + Novo resultado
          </button>
        )}
      </div>

      {draft && (
        <div className="panel" style={{ background: "#fbfaf5", marginBottom: 16 }}>
          <div className="form-2col">
            <div className="field">
              <label htmlFor="r-type">Tipo</label>
              <select id="r-type" className="select" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                {RESULT_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="r-title">Título</label>
              <input id="r-title" className="input" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="field span-2">
              <label htmlFor="r-entries">Lista (uma linha por candidato)</label>
              <textarea
                id="r-entries"
                className="textarea"
                style={{ fontFamily: "monospace", minHeight: 160 }}
                placeholder={"2027-001;1;Aprovado\n2027-014;2;Aprovado\n2027-020;Classificado"}
                value={draft.entriesText}
                onChange={(e) => setDraft({ ...draft, entriesText: e.target.value })}
              />
              <span className="help">
                Formato: <code>protocolo;posição;situação</code> ou <code>protocolo;situação</code>. Use somente número de inscrição/protocolo — nunca nomes completos, CPF, e-mail ou telefone.
              </span>
            </div>
            <Field field={{ name: "bodyHtml", label: "Texto/comunicado (opcional)", kind: "rich" }} value={draft.bodyHtml} onChange={(v) => setDraft({ ...draft, bodyHtml: String(v) })} idPrefix="r" />
            <Field field={{ name: "documentMediaIds", label: "Documentos PDF", kind: "mediaList", mediaKind: "pdf" }} value={draft.documentMediaIds} onChange={(v) => setDraft({ ...draft, documentMediaIds: v as string[] })} idPrefix="r" />
          </div>
          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" disabled={busy || draft.title.length < 3} onClick={() => void save()}>
              Salvar
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="muted">Nenhum resultado cadastrado.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Resultado</th>
                <th scope="col">Status</th>
                <th scope="col">Atualizado</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {RESULT_TYPE_LABELS[r.type]} · {r.entries.length} registro(s){r.version > 1 ? ` · versão ${r.version}` : ""}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={r.status} publishAt={r.publishAt} />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.updatedAt)}</td>
                  <td>
                    <div className="row-actions">
                      {can("results:write") && (r.status !== "published" || can("results:publish")) && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setDraft({ id: r.id, type: r.type, title: r.title, bodyHtml: r.bodyHtml ?? "", entriesText: entriesToText(r.entries), documentMediaIds: r.documentMediaIds ?? [] })
                          }
                        >
                          Editar
                        </button>
                      )}
                      {can("results:publish") && r.status !== "published" && (
                        <button className="btn btn-primary btn-sm" onClick={() => void publish(r)}>
                          Publicar
                        </button>
                      )}
                      {can("results:publish") && r.status === "published" && (
                        <button className="btn btn-outline btn-sm" onClick={() => void act(r, "unpublish")}>
                          Despublicar
                        </button>
                      )}
                      {can("results:publish") && can("content:delete") && (
                        <button className="btn btn-ghost btn-sm" onClick={() => void act(r, "delete")}>
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
        Publicações e substituições de resultados são registradas na auditoria.
      </p>
    </section>
  );
}
