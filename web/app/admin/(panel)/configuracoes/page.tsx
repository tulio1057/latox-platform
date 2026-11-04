"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { Field } from "@/components/admin/FormFields";
import { admin, errorMessage } from "@/lib/admin-api";
import type { FieldDef } from "@/lib/admin-config";

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Identidade",
    fields: [
      { name: "siteName", label: "Nome institucional", kind: "text", required: true, max: 120 },
      { name: "shortName", label: "Sigla", kind: "text", required: true, max: 30 },
      { name: "tagline", label: "Slogan", kind: "text", max: 200 },
      { name: "logoMediaId", label: "Logo (substitui a logo oficial padrão)", kind: "media", mediaKind: "image", nullable: true, help: "Deixe vazio para usar a logo oficial fornecida." },
      { name: "institution", label: "Instituição de ensino", kind: "text", max: 200 },
      { name: "description", label: "Descrição institucional", kind: "textarea", max: 600 },
    ],
  },
  {
    title: "Página inicial e Sobre",
    fields: [
      { name: "heroTitle", label: "Frase de impacto (use vírgula para destacar a 2ª parte)", kind: "text", max: 160 },
      { name: "heroSubtitle", label: "Apresentação breve", kind: "textarea", max: 600 },
      { name: "aboutIntro", label: "Apresentação (Sobre)", kind: "textarea", max: 1500 },
      { name: "historyHtml", label: "História", kind: "rich" },
      { name: "mission", label: "Missão", kind: "textarea", max: 800 },
      { name: "vision", label: "Visão", kind: "textarea", max: 800 },
      { name: "values", label: "Valores", kind: "stringList" },
      { name: "objectives", label: "Objetivos acadêmicos", kind: "stringList" },
      { name: "teaching", label: "Atuação em ensino", kind: "textarea", max: 1000 },
      { name: "research", label: "Atuação em pesquisa", kind: "textarea", max: 1000 },
      { name: "extension", label: "Atuação em extensão", kind: "textarea", max: 1000 },
    ],
  },
  {
    title: "Contato, rodapé e redes",
    fields: [
      { name: "contactEmail", label: "E-mail institucional", kind: "text", max: 200 },
      { name: "instagramUrl", label: "Instagram (URL)", kind: "url" },
      { name: "address", label: "Localização institucional", kind: "text", max: 300 },
      {
        name: "socialLinks",
        label: "Outros links oficiais",
        kind: "objectList",
        itemFields: [
          { name: "label", label: "Nome", kind: "text", max: 60, required: true },
          { name: "url", label: "URL https", kind: "url", required: true },
        ],
      },
      { name: "footerText", label: "Texto do rodapé", kind: "textarea", max: 400 },
    ],
  },
  {
    title: "SEO",
    fields: [
      { name: "seoTitle", label: "Título padrão (até 70 caracteres)", kind: "text", max: 70 },
      { name: "seoDescription", label: "Descrição padrão (até 170 caracteres)", kind: "textarea", max: 170 },
    ],
  },
  {
    title: "Privacidade (LGPD)",
    fields: [
      { name: "privacyEmail", label: "E-mail para assuntos de privacidade", kind: "text", max: 200 },
      { name: "privacyUpdatedAt", label: "Data da última revisão da política", kind: "date", nullable: true },
      {
        name: "privacyPolicyHtml",
        label: "Política de privacidade revisada",
        kind: "rich",
        help: "Enquanto vazia, o site exibe uma versão-base (marcada como pendente de revisão) que descreve o funcionamento técnico real do site.",
      },
    ],
  },
];

const ALL = SECTIONS.flatMap((s) => s.fields);

export default function SettingsPage() {
  const { can, toast } = useAdmin();
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const editable = can("settings:write");

  useEffect(() => {
    admin
      .get<Record<string, unknown>>("/settings")
      .then((s) => setValues(s))
      .catch((e) => toast("error", errorMessage(e)));
  }, [toast]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!values) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of ALL) {
        let v = values[f.name];
        if (f.kind === "stringList") v = ((v as string[]) ?? []).map((x) => x.trim()).filter(Boolean);
        if (f.kind === "objectList") v = ((v as Record<string, string>[]) ?? []).filter((o) => o.label && o.url);
        if ((v === "" || v === undefined) && f.nullable) v = null;
        payload[f.name] = v ?? (f.nullable ? null : "");
      }
      await admin.put("/settings", payload);
      toast("success", "Configurações salvas. O site é atualizado em até 1 minuto.");
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!values) return <p role="status">Carregando…</p>;

  return (
    <form onSubmit={save}>
      <div className="admin-page-head">
        <h1>Configurações gerais</h1>
        {editable && (
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Salvando…" : "Salvar configurações"}
          </button>
        )}
      </div>
      {!editable && <div className="alert alert-warn">Somente Super Admins podem alterar as configurações.</div>}
      <div className="alert alert-info" style={{ margin: "12px 0" }}>
        Textos que começam com <strong>[PREENCHER]</strong> são espaços reservados e não são exibidos como informação oficial no site.
      </div>
      <fieldset disabled={!editable} style={{ border: "none", padding: 0, margin: 0 }}>
        {SECTIONS.map((s) => (
          <section key={s.title} className="panel">
            <h2>{s.title}</h2>
            <div className="form-2col">
              {s.fields.map((f) => (
                <Field key={f.name} field={f} value={values[f.name] ?? (f.kind === "stringList" || f.kind === "objectList" ? [] : "")} onChange={(v) => setValues((x) => ({ ...x!, [f.name]: v }))} />
              ))}
            </div>
          </section>
        ))}
      </fieldset>
    </form>
  );
}
