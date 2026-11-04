import { z } from "zod";
import { category, httpsUrl, isoDate, isoDateTime, mediaId, richText, slug, text } from "../../lib/fields";

export const PROJECT_STATUS = ["planejado", "em_andamento", "concluido"] as const;
export const EVENT_STATUS = ["agendado", "adiado", "cancelado", "encerrado"] as const;
export const TEAM_GROUPS = ["presidencia", "vice_presidencia", "diretoria", "coordenacao", "membros"] as const;
export const SELECTION_PHASES = [
  "em_breve",
  "inscricoes_abertas",
  "inscricoes_encerradas",
  "em_analise",
  "resultado_preliminar",
  "periodo_recursos",
  "resultado_final",
  "finalizado",
] as const;
export const RESULT_TYPES = ["preliminar", "final", "aprovados", "classificados", "comunicado"] as const;

/*
 * Schemas are .strict(): unknown keys (status, createdBy, publishedAt, id...) are rejected,
 * which prevents mass assignment. Status changes only happen through dedicated endpoints.
 */

export const newsSchema = z
  .object({
    title: text(200, 3),
    slug: slug.optional(),
    summary: text(500),
    contentHtml: richText(),
    category,
    coverMediaId: mediaId.nullable().optional(),
    coverAlt: text(200).optional(),
    author: text(120).optional(),
  })
  .strict();

export const projectSchema = z
  .object({
    title: text(200, 3),
    slug: slug.optional(),
    summary: text(500),
    descriptionHtml: richText(),
    category,
    coverMediaId: mediaId.nullable().optional(),
    coverAlt: text(200).optional(),
    galleryMediaIds: z.array(mediaId).max(30).optional(),
    responsible: z.array(text(120, 1)).max(20).optional(),
    date: isoDate.nullable().optional(),
    projectStatus: z.enum(PROJECT_STATUS),
  })
  .strict();

export const eventSchema = z
  .object({
    title: text(200, 3),
    slug: slug.optional(),
    summary: text(500),
    descriptionHtml: richText(),
    category,
    coverMediaId: mediaId.nullable().optional(),
    coverAlt: text(200).optional(),
    startAt: isoDateTime,
    endAt: isoDateTime.nullable().optional(),
    location: text(200),
    schedule: z
      .array(z.object({ time: text(20), title: text(200, 1), description: text(500).optional() }).strict())
      .max(50)
      .optional(),
    speakers: z
      .array(z.object({ name: text(120, 1), role: text(160).optional(), bio: text(600).optional() }).strict())
      .max(30)
      .optional(),
    registrationUrl: httpsUrl.nullable().optional(),
    eventStatus: z.enum(EVENT_STATUS),
  })
  .strict();

export const teamSchema = z
  .object({
    name: text(120, 2),
    photoMediaId: mediaId.nullable().optional(),
    position: text(120, 1),
    group: z.enum(TEAM_GROUPS),
    course: text(120).optional(),
    period: text(40).optional(),
    bio: text(600).optional(),
    link: httpsUrl.nullable().optional(),
    order: z.number().int().min(0).max(10_000),
  })
  .strict();

export const selectionProcessSchema = z
  .object({
    title: text(200, 3),
    slug: slug.optional(),
    summary: text(500),
    descriptionHtml: richText(),
    phase: z.enum(SELECTION_PHASES),
    registrationStart: isoDateTime.nullable().optional(),
    registrationEnd: isoDateTime.nullable().optional(),
    /** External registration form (Google Forms, Microsoft Forms...). Never fixed in code. */
    registrationUrl: httpsUrl.nullable().optional(),
    noticeMediaId: mediaId.nullable().optional(),
    noticeUrl: httpsUrl.nullable().optional(),
    requirements: z.array(text(300, 1)).max(30).optional(),
    schedule: z.array(z.object({ date: text(40, 1), label: text(200, 1) }).strict()).max(40).optional(),
    stages: z.array(z.object({ title: text(160, 1), description: text(600).optional() }).strict()).max(20).optional(),
    criteria: z.array(text(300, 1)).max(30).optional(),
    vacancies: z.number().int().min(0).max(10_000).nullable().optional(),
    documents: z
      .array(
        z
          .object({ label: text(160, 1), mediaId: mediaId.optional(), url: httpsUrl.optional() })
          .strict()
          .refine((d) => Boolean(d.mediaId) !== Boolean(d.url), "Informe um arquivo OU um link."),
      )
      .max(30)
      .optional(),
  })
  .strict();

/**
 * Results: data minimisation by design — candidates are identified only by their
 * registration protocol. There is intentionally no field for name, CPF, e-mail or phone.
 */
export const resultSchema = z
  .object({
    type: z.enum(RESULT_TYPES),
    title: text(200, 3),
    bodyHtml: richText(50_000).optional(),
    entries: z
      .array(
        z
          .object({
            protocol: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9._/-]+$/, "Protocolo inválido."),
            position: z.number().int().min(1).max(100_000).nullable().optional(),
            situation: text(60, 1),
          })
          .strict(),
      )
      .max(2000)
      .optional(),
    documentMediaIds: z.array(mediaId).max(20).optional(),
  })
  .strict();

export const publishBody = z.object({ publishAt: isoDateTime.optional() }).strict();
export const confirmPublishBody = z
  .object({ publishAt: isoDateTime.optional(), confirm: z.literal(true) })
  .strict();
