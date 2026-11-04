"use client";

import { useState } from "react";
import type { FieldDef } from "@/lib/admin-config";
import { MediaPickerDialog, MediaThumb } from "./MediaPicker";
import { RichEditor } from "./RichEditor";

type Values = Record<string, unknown>;

/** ISO → value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converts the form state into the API payload (only declared fields — no extras). */
export function toPayload(fields: FieldDef[], values: Values): Values {
  const out: Values = {};
  for (const f of fields) {
    let v = values[f.name];
    if (f.kind === "datetime") v = typeof v === "string" && v ? new Date(v).toISOString() : null;
    if (f.kind === "number") v = v === "" || v === undefined || v === null ? null : Number(v);
    if (f.kind === "stringList") v = Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];
    if (f.kind === "objectList" && Array.isArray(v)) {
      v = v.map((item: Values) => {
        const o: Values = {};
        for (const sf of f.itemFields ?? []) {
          const x = item[sf.name];
          if (x !== undefined && x !== null && String(x).trim() !== "") o[sf.name] = typeof x === "string" ? x.trim() : x;
        }
        return o;
      });
    }
    if ((v === "" || v === undefined || v === null) && f.nullable) v = null;
    if (v === undefined) continue;
    if (v === null && !f.nullable) continue;
    if (f.name === "slug" && v === "") continue;
    out[f.name] = v;
  }
  return out;
}

export function fromDoc(fields: FieldDef[], doc: Values): Values {
  const out: Values = {};
  for (const f of fields) {
    const v = doc[f.name];
    if (f.kind === "datetime") out[f.name] = toLocalInput(v);
    else if (f.kind === "number") out[f.name] = v ?? "";
    else out[f.name] = v ?? (f.kind === "stringList" || f.kind === "objectList" || f.kind === "mediaList" ? [] : "");
  }
  return out;
}

function MediaField({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const multiple = field.kind === "mediaList";
  const ids: string[] = multiple ? ((value as string[]) ?? []) : value ? [value as string] : [];
  return (
    <div className="stack">
      {ids.length > 0 && (
        <div className="media-preview">
          {ids.map((id) => (
            <span key={id} style={{ display: "inline-grid", gap: 4 }}>
              <MediaThumb id={id} kind={field.mediaKind} name="Arquivo selecionado" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(multiple ? ids.filter((x) => x !== id) : null)}>
                Remover
              </button>
            </span>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-outline btn-sm" style={{ width: "fit-content" }} onClick={() => setOpen(true)}>
        {ids.length && !multiple ? "Trocar arquivo" : multiple ? "Adicionar da biblioteca" : "Escolher da biblioteca"}
      </button>
      <MediaPickerDialog
        open={open}
        kind={field.mediaKind ?? "image"}
        multiple={multiple}
        onClose={() => setOpen(false)}
        onSelect={(items) => {
          setOpen(false);
          onChange(multiple ? [...new Set([...ids, ...items.map((i) => i.id)])].slice(0, 30) : (items[0]?.id ?? null));
        }}
      />
    </div>
  );
}

function StringList({ id, value, onChange }: { id: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="list-stack">
      {value.map((s, i) => (
        <div key={i} className="list-item">
          <input aria-label={`Item ${i + 1}`} className="input" value={s} maxLength={300} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remover item ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button id={id} type="button" className="btn btn-outline btn-sm" style={{ width: "fit-content" }} onClick={() => onChange([...value, ""])}>
        + Adicionar item
      </button>
    </div>
  );
}

function ObjectList({ field, value, onChange }: { field: FieldDef; value: Values[]; onChange: (v: Values[]) => void }) {
  const move = (i: number, d: number) => {
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };
  return (
    <div className="list-stack">
      {value.map((item, i) => (
        <fieldset key={i} className="list-item" style={{ gridTemplateColumns: "1fr" }}>
          <legend className="sr-only">
            {field.label} {i + 1}
          </legend>
          <div className="form-2col">
            {(field.itemFields ?? []).map((sf) => (
              <Field key={sf.name} field={sf} idPrefix={`${field.name}-${i}`} value={item[sf.name] ?? (sf.kind === "media" ? null : "")} onChange={(v) => onChange(value.map((x, j) => (j === i ? { ...x, [sf.name]: v } : x)))} />
            ))}
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Mover para cima">
              ↑
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Mover para baixo">
              ↓
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              Remover
            </button>
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn btn-outline btn-sm" style={{ width: "fit-content" }} onClick={() => onChange([...value, {}])}>
        + Adicionar
      </button>
    </div>
  );
}

export function Field({ field, value, onChange, idPrefix = "f" }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; idPrefix?: string }) {
  const id = `${idPrefix}-${field.name}`;
  const wide = ["rich", "textarea", "objectList", "stringList", "mediaList"].includes(field.kind);
  const label = (
    <label htmlFor={id}>
      {field.label} {field.required && <span className="req" aria-hidden="true">*</span>}
    </label>
  );
  let control: React.ReactNode;
  switch (field.kind) {
    case "textarea":
      control = <textarea id={id} className="textarea" maxLength={field.max} required={field.required} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "rich":
      control = <RichEditor id={id} value={String(value ?? "")} onChange={onChange} />;
      break;
    case "select":
      control = (
        <select id={id} className="select" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "date":
      control = <input id={id} className="input" type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "datetime":
      control = <input id={id} className="input" type="datetime-local" required={field.required} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
      control = <input id={id} className="input" type="number" min={0} step={1} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "url":
      control = <input id={id} className="input" type="url" inputMode="url" placeholder="https://" pattern="https://.*" maxLength={2000} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "media":
    case "mediaList":
      control = <MediaField field={field} value={value} onChange={onChange} />;
      break;
    case "stringList":
      control = <StringList id={id} value={(value as string[]) ?? []} onChange={onChange} />;
      break;
    case "objectList":
      control = <ObjectList field={field} value={(value as Values[]) ?? []} onChange={onChange} />;
      break;
    default:
      control = <input id={id} className="input" type="text" maxLength={field.max} required={field.required} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className={`field${wide ? " span-2" : ""}`}>
      {field.kind === "media" || field.kind === "mediaList" || field.kind === "objectList" ? <span className="label">{field.label}</span> : label}
      {control}
      {field.help && <span className="help">{field.help}</span>}
    </div>
  );
}
