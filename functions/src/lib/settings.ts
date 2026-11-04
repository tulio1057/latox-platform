import { z } from "zod";
import { httpsUrl, mediaId, richText, text } from "./fields";
import { COLLECTIONS, db } from "./firebase";
import { mediaUrl, serialize } from "./serialize";

/**
 * Site-wide editable settings. Defaults are explicit placeholders: they must be replaced
 * with official LATox information through the admin panel before launch.
 */
export const settingsSchema = z
  .object({
    siteName: text(120, 2),
    shortName: text(30, 2),
    tagline: text(200),
    description: text(600),
    heroTitle: text(160),
    heroSubtitle: text(600),
    aboutIntro: text(1500),
    historyHtml: richText(30_000),
    mission: text(800),
    vision: text(800),
    values: z.array(text(200, 1)).max(15),
    objectives: z.array(text(300, 1)).max(20),
    teaching: text(1000),
    research: text(1000),
    extension: text(1000),
    institution: text(200),
    address: text(300),
    contactEmail: z.union([z.literal(""), z.email().max(200)]),
    privacyEmail: z.union([z.literal(""), z.email().max(200)]),
    instagramUrl: z.union([z.literal(""), httpsUrl]),
    socialLinks: z.array(z.object({ label: text(60, 1), url: httpsUrl }).strict()).max(10),
    footerText: text(400),
    logoMediaId: mediaId.nullable(),
    seoTitle: text(70),
    seoDescription: text(170),
    privacyPolicyHtml: richText(80_000),
    privacyUpdatedAt: z.iso.date().nullable(),
  })
  .strict();

export type SiteSettings = z.infer<typeof settingsSchema>;

const P = "[PREENCHER]";

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Liga Acadêmica de Toxicologia",
  shortName: "LATox",
  tagline: "Ciência, saúde e compromisso com a vida.",
  description: `${P} Descrição institucional da LATox — editar em Admin › Configurações.`,
  heroTitle: "Conhecimento que protege, ciência que transforma.",
  heroSubtitle: `${P} Breve apresentação da LATox — editar em Admin › Configurações.`,
  aboutIntro: `${P} Texto de apresentação da liga.`,
  historyHtml: `<p>${P} História da LATox.</p>`,
  mission: `${P} Missão.`,
  vision: `${P} Visão.`,
  values: [`${P} Valor 1`, `${P} Valor 2`, `${P} Valor 3`],
  objectives: [`${P} Objetivo acadêmico 1`, `${P} Objetivo acadêmico 2`],
  teaching: `${P} Atuação em ensino.`,
  research: `${P} Atuação em pesquisa.`,
  extension: `${P} Atuação em extensão.`,
  institution: `${P} Instituição de ensino`,
  address: "",
  contactEmail: "",
  privacyEmail: "",
  instagramUrl: "",
  socialLinks: [],
  footerText: `${P} Texto do rodapé.`,
  logoMediaId: null,
  seoTitle: "LATox — Liga Acadêmica de Toxicologia",
  seoDescription: "Liga Acadêmica de Toxicologia: ensino, pesquisa e extensão em toxicologia.",
  privacyPolicyHtml: "",
  privacyUpdatedAt: null,
};

const ref = () => db.collection(COLLECTIONS.settings).doc("site");

export async function getSettings(): Promise<SiteSettings & { updatedAt?: unknown }> {
  const snap = await ref().get();
  return { ...DEFAULT_SETTINGS, ...(snap.data() ?? {}) } as SiteSettings;
}

export function publicSettings(s: SiteSettings) {
  return serialize({ ...s, logoUrl: mediaUrl(s.logoMediaId) });
}

export const settingsRef = ref;
