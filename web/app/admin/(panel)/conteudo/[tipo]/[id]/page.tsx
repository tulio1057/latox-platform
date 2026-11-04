"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { Field, fromDoc, toPayload } from "@/components/admin/FormFields";
import { Preview } from "@/components/admin/Preview";
import { ResultsManager } from "@/components/admin/ResultsManager";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { admin, errorMessage } from "@/lib/admin-api";
import { CONTENT_TYPES } from "@/lib/admin-config";
import { formatDateTime } from "@/lib/format";
import type { SelectionResult } from "@/lib/types";

interface Doc extends Record<string, unknown> {
  id: string;
  status: string;
  slug?: string;
  publishAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export default function ContentEditPage() {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const cfg = CONTENT_TYPES[tipo];
  const isNew = id === "novo";
  const router = useRouter();
  const { can, toast, confirm } = useAdmin();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [results, setResults] = useState<SelectionResult[]>([]);

  const load = useCallback(async () => {
    if (!cfg) return;
    if (isNew) {
      setValues(fromDoc(cfg.fields, cfg.defaults));
      return;
    }
    try {
      const d = await admin.get<Doc>(`/${cfg.api}/${id}`);
      setDoc(d);
      setValues(fromDoc(cfg.fields, d));
      setDirty(false);
    } catch (e) {
      toast("error", errorMessage(e));
      router.replace(`/admin/conteudo/${tipo}`);
    }
  }, [cfg, id, isNew, router, tipo, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (!cfg) notFound();
  if (!values) return <p role="status">Carregando…</p>;

  const isLive = doc?.status === "published";
  const readOnly = !can("content:write") || (isLive && !can("content:publish"));

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!cfg || !values) return;
    setSaving(true);
    try {
      const payload = toPayload(cfg.fields, values);
      if (isNew) {
        const r = await admin.post<{ id: string }>(`/${cfg.api}`, payload);
        toast("success", "Rascunho criado.");
        setDirty(false);
        router.replace(`/admin/conteudo/${tipo}/${r.id}`);
      } else {
        await admin.patch(`/${cfg.api}/${id}`, payload);
        toast("success", isLive ? "Alterações publicadas." : "Rascunho salvo.");
        await load();
      }
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function action(path: string, body: unknown, okMsg: string) {
    try {
      await admin.post(`/${cfg!.api}/${id}/${path}`, body);
      toast("success", okMsg);
      await load();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  async function publish() {
    if (dirty) return toast("info", "Salve as alterações antes de publicar.");
    const when = schedule ? new Date(schedule) : null;
    const ok = await confirm({
      title: when ? "Agendar publicação?" : "Publicar agora?",
      body: when ? `O conteúdo ficará visível no site a partir de ${formatDateTime(when.toISOString())}.` : "O conteúdo ficará visível publicamente no site imediatamente.",
      confirmLabel: when ? "Agendar" : "Publicar",
    });
    if (ok) await action("publish", when ? { publishAt: when.toISOString() } : {}, when ? "Publicação agendada." : "Publicado.");
  }

  async function remove() {
    const ok = await confirm({
      title: `Excluir ${cfg!.singular}?`,
      body: "Esta ação remove o conteúdo do site e do painel. Uma cópia fica registrada no histórico de revisões para auditoria.",
      confirmLabel: "Excluir definitivamente",
      danger: true,
    });
    if (!ok) return;
    try {
      await admin.del(`/${cfg!.api}/${id}`);
      toast("success", "Excluído.");
      setDirty(false);
      router.replace(`/admin/conteudo/${tipo}`);
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  const set = (name: string) => (v: unknown) => {
    setValues((s) => ({ ...s!, [name]: v }));
    setDirty(true);
  };

  return (
    <>
      <div className="admin-page-head">
        <div>
          <Link href={`/admin/conteudo/${tipo}`} className="muted" style={{ fontSize: "0.88rem" }}>
            ← {cfg.label}
          </Link>
          <h1>{isNew ? `Novo ${cfg.singular}` : String(values[cfg.titleField] || "Sem título")}</h1>
          {doc && (
            <div className="card-meta" style={{ marginTop: 6 }}>
              <StatusBadge status={doc.status} publishAt={doc.publishAt} />
              <span>Atualizado em {formatDateTime(doc.updatedAt)}</span>
              {doc.publishAt && doc.status === "published" && <span>· Visível desde {formatDateTime(doc.publishAt)}</span>}
              {isLive && cfg.publicPath && doc.slug && (
                <a href={cfg.publicPath(doc.slug)} target="_blank" rel="noopener noreferrer">
                  Ver no site ↗
                </a>
              )}
            </div>
          )}
        </div>
        <div className="toolbar">
          <button type="button" className="btn btn-ghost" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>
            {preview ? "Voltar à edição" : "Pré-visualizar"}
          </button>
          {!readOnly && (
            <button type="submit" form="content-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Salvando…" : isNew ? "Salvar rascunho" : isLive ? "Salvar e publicar alterações" : "Salvar rascunho"}
            </button>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          {isLive ? "Este conteúdo está publicado. Apenas publicadores podem alterá-lo." : "Você tem acesso somente leitura."}
        </div>
      )}

      {preview ? (
        <div className="preview-frame" aria-label="Pré-visualização">
          <p className="badge badge-warn" style={{ marginBottom: 16 }}>
            Pré-visualização — {doc?.status === "published" ? "conteúdo publicado" : "não publicado"}
          </p>
          <Preview tipo={tipo} doc={{ ...values, ...toPayload(cfg.fields, values) }} results={results} />
        </div>
      ) : (
        <form id="content-form" onSubmit={save} className="panel">
          <fieldset disabled={readOnly} style={{ border: "none", padding: 0, margin: 0 }}>
            <div className="form-2col">
              {cfg.fields.map((f) => (
                <Field key={f.name} field={f} value={values[f.name]} onChange={set(f.name)} />
              ))}
            </div>
          </fieldset>
        </form>
      )}

      {!isNew && doc && (
        <section className="panel" aria-labelledby="pub-title">
          <h2 id="pub-title">Publicação</h2>
          {can("content:publish") ? (
            <div className="toolbar">
              {doc.status !== "published" && (
                <>
                  <label className="field" style={{ minWidth: 240 }}>
                    <span className="label">Agendar para (opcional)</span>
                    <input className="input" type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
                  </label>
                  <button className="btn btn-primary" onClick={() => void publish()} style={{ alignSelf: "end" }}>
                    {schedule ? "Agendar publicação" : "Publicar"}
                  </button>
                </>
              )}
              {doc.status === "published" && (
                <button className="btn btn-outline" onClick={() => void action("unpublish", {}, "Conteúdo despublicado (voltou a rascunho).")}>
                  Despublicar
                </button>
              )}
              {doc.status !== "archived" && (
                <button className="btn btn-outline" onClick={() => void action("archive", {}, "Conteúdo arquivado.")}>
                  Arquivar
                </button>
              )}
              <span className="spacer" />
              {can("content:delete") && (
                <button className="btn btn-danger" onClick={() => void remove()}>
                  Excluir
                </button>
              )}
            </div>
          ) : (
            <p className="muted mt-0">Seu perfil (Editor) prepara rascunhos. Um Publicador ou Super Admin revisa e publica.</p>
          )}
        </section>
      )}

      {tipo === "processos" && !isNew && doc && <ResultsManager processId={doc.id} onChange={setResults} />}
    </>
  );
}
