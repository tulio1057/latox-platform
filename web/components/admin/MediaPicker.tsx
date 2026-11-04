"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { admin, errorMessage } from "@/lib/admin-api";
import { IconFile } from "../icons";
import { useAdmin } from "./AdminProvider";

export interface MediaItem {
  id: string;
  name: string;
  kind: "image" | "pdf";
  mimeType: string;
  size: number;
  isPublic: boolean;
  folder: string;
  createdAt: string;
  url: string;
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Upload helper shared by the picker and the media library. */
export async function uploadFile(file: File, opts: { isPublic: boolean; folder?: string }) {
  const form = new FormData();
  form.set("isPublic", String(opts.isPublic));
  form.set("folder", opts.folder ?? "geral");
  form.set("file", file);
  return admin.upload<MediaItem>("/media", form);
}

export function MediaThumb({ id, kind, name }: { id: string; kind?: "image" | "pdf"; name?: string }) {
  if (kind === "pdf") {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <IconFile /> {name ?? "PDF"}
      </span>
    );
  }
  return <img src={`/api/v1/admin/media/${id}/file`} alt={name ?? ""} />;
}

/** Modal library browser + uploader. Calls onSelect with the chosen item(s). */
export function MediaPickerDialog({
  open,
  kind,
  multiple = false,
  onClose,
  onSelect,
}: {
  open: boolean;
  kind: "image" | "pdf";
  multiple?: boolean;
  onClose: () => void;
  onSelect: (items: MediaItem[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { toast, can } = useAdmin();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.get<{ items: MediaItem[] }>(`/media?kind=${kind}&pageSize=50`);
      setItems(r.items);
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [kind, toast]);

  useEffect(() => {
    if (open) {
      setSelected([]);
      ref.current?.showModal();
      void load();
    } else ref.current?.close();
  }, [open, load]);

  const toggle = (m: MediaItem) =>
    setSelected((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : multiple ? [...s, m] : [m]));

  return (
    <dialog ref={ref} className="modal modal-wide" aria-labelledby="picker-title" onCancel={(e) => (e.preventDefault(), onClose())}>
      <div className="modal-body">
        <h2 id="picker-title">{kind === "pdf" ? "Selecionar documento PDF" : "Selecionar imagem"}</h2>
        {can("media:upload") && (
          <label className="btn btn-outline btn-sm" style={{ width: "fit-content" }}>
            Enviar novo arquivo
            <input
              type="file"
              className="sr-only"
              accept={kind === "pdf" ? "application/pdf,.pdf" : "image/jpeg,image/png,image/webp"}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const m = await uploadFile(f, { isPublic: true, folder: kind === "pdf" ? "documentos" : "imagens" });
                  toast("success", "Arquivo enviado.");
                  setItems((s) => [m, ...s]);
                  setSelected((s) => (multiple ? [...s, m] : [m]));
                } catch (err) {
                  toast("error", errorMessage(err));
                }
              }}
            />
          </label>
        )}
        {loading ? (
          <p role="status">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="muted">Nenhum arquivo na biblioteca.</p>
        ) : (
          <div className="media-grid" style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {items.map((m) => (
              <button key={m.id} type="button" className="media-tile" aria-pressed={selected.some((s) => s.id === m.id)} onClick={() => toggle(m)}>
                <div className="thumb">
                  <MediaThumb id={m.id} kind={m.kind} />
                </div>
                <div className="name" title={m.name}>
                  {!m.isPublic && "🔒 "}
                  {m.name}
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="help muted" style={{ fontSize: "0.8rem", margin: 0 }}>
          Arquivos marcados com 🔒 são privados e não aparecerão no site público.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="button" disabled={!selected.length} onClick={() => onSelect(selected)}>
            Usar selecionado{multiple && selected.length > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </dialog>
  );
}
