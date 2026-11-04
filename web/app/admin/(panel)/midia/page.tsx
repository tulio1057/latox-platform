"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { formatBytes, MediaThumb, uploadFile, type MediaItem } from "@/components/admin/MediaPicker";
import { admin, errorMessage } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";

const FOLDERS = { geral: "Geral", imagens: "Imagens", editais: "Editais", documentos: "Documentos institucionais", eventos: "Materiais de eventos" };

export default function MediaPage() {
  const { can, toast, confirm } = useAdmin();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [folder, setFolder] = useState("");
  const [kind, setKind] = useState("");
  const [uploadFolder, setUploadFolder] = useState("imagens");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = new URLSearchParams({ pageSize: "50" });
      if (folder) s.set("folder", folder);
      if (kind) s.set("kind", kind);
      setItems((await admin.get<{ items: MediaItem[] }>(`/media?${s}`)).items);
    } catch (e) {
      toast("error", errorMessage(e));
      setItems([]);
    }
  }, [folder, kind, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      try {
        await uploadFile(f, { isPublic, folder: uploadFolder });
        toast("success", `“${f.name}” enviado.`);
      } catch (e) {
        toast("error", `“${f.name}”: ${errorMessage(e)}`);
      }
    }
    setBusy(false);
    await load();
  }

  async function replace(m: MediaItem, file: File | undefined) {
    if (!file) return;
    const ok = await confirm({ title: "Substituir arquivo?", body: `O conteúdo de “${m.name}” será trocado em todos os lugares onde é utilizado.`, confirmLabel: "Substituir", danger: true });
    if (!ok) return;
    try {
      const form = new FormData();
      form.set("file", file);
      await admin.upload(`/media/${m.id}/file`, form, "PUT");
      toast("success", "Arquivo substituído.");
      await load();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  async function remove(m: MediaItem) {
    const ok = await confirm({ title: "Excluir arquivo?", body: `“${m.name}” será excluído permanentemente. Conteúdos que o utilizam ficarão sem a imagem/documento.`, confirmLabel: "Excluir", danger: true });
    if (!ok) return;
    try {
      await admin.del(`/media/${m.id}`);
      toast("success", "Arquivo excluído.");
      await load();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  async function toggleVisibility(m: MediaItem) {
    try {
      await admin.patch(`/media/${m.id}`, { isPublic: !m.isPublic });
      await load();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  return (
    <>
      <div className="admin-page-head">
        <h1>Biblioteca de arquivos</h1>
      </div>
      {can("media:upload") && (
        <section className="panel" aria-labelledby="up-h">
          <h2 id="up-h">Enviar arquivos</h2>
          <div className="toolbar">
            <label className="field">
              <span className="label">Pasta</span>
              <select className="select" value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)}>
                {Object.entries(FOLDERS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox" style={{ alignSelf: "end", minHeight: 46 }}>
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Público (pode aparecer no site)
            </label>
            <label className="btn btn-primary" style={{ alignSelf: "end" }} aria-disabled={busy}>
              {busy ? "Enviando…" : "Escolher arquivos"}
              <input type="file" className="sr-only" multiple accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(e) => void onUpload(e.target.files).finally(() => (e.target.value = ""))} />
            </label>
          </div>
          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: 0 }}>
            Permitidos: JPG, PNG, WEBP e PDF (até 4 MB; editais maiores podem ser publicados como link externo). Imagens são convertidas para WEBP e têm metadados (ex.: localização GPS) removidos. PDFs com scripts ou anexos embutidos são recusados.
          </p>
        </section>
      )}
      <section className="panel">
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <select className="select" style={{ width: "auto" }} aria-label="Filtrar por pasta" value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">Todas as pastas</option>
            {Object.entries(FOLDERS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: "auto" }} aria-label="Filtrar por tipo" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="image">Imagens</option>
            <option value="pdf">PDFs</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Arquivo</th>
                <th scope="col">Tipo</th>
                <th scope="col">Tamanho</th>
                <th scope="col">Enviado em</th>
                <th scope="col">Visibilidade</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items === null ? (
                <tr>
                  <td colSpan={6}>Carregando…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nenhum arquivo.</td>
                </tr>
              ) : (
                items.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="media-preview">
                        {m.kind === "image" ? <MediaThumb id={m.id} kind="image" name={m.name} /> : null}
                        <a href={`/api/v1/admin/media/${m.id}/file`} target="_blank" rel="noopener noreferrer">
                          {m.name}
                        </a>
                      </div>
                    </td>
                    <td>{m.kind === "pdf" ? "PDF" : "Imagem"}</td>
                    <td>{formatBytes(m.size)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(m.createdAt)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => void toggleVisibility(m)} disabled={!can("media:upload")} title="Alternar visibilidade">
                        {m.isPublic ? "🌐 Público" : "🔒 Privado"}
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        {m.isPublic && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              void navigator.clipboard.writeText(`${location.origin}/api/v1/public/media/${m.id}`);
                              toast("info", "Link público copiado.");
                            }}
                          >
                            Copiar link
                          </button>
                        )}
                        {can("media:delete") && (
                          <>
                            <label className="btn btn-ghost btn-sm">
                              Substituir
                              <input type="file" className="sr-only" accept={m.kind === "pdf" ? "application/pdf" : "image/jpeg,image/png,image/webp"} onChange={(e) => void replace(m, e.target.files?.[0]).finally(() => (e.target.value = ""))} />
                            </label>
                            <button className="btn btn-ghost btn-sm" onClick={() => void remove(m)}>
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
