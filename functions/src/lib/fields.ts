import { z } from "zod";
import { plainText, sanitizeRichText } from "./sanitize";
import { SLUG_RE } from "./slug";

/** Reusable, strictly bounded field validators. Every string has a max length. */
export const text = (max: number, min = 0) =>
  z.string().trim().min(min).max(max).transform((v) => plainText(v));

export const richText = (max = 100_000) => z.string().max(max).transform((v) => sanitizeRichText(v));

export const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const mediaId = z.string().regex(ID_RE, "Identificador de mídia inválido.");

export function isSafeExternalUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** External links (forms, editais, social). HTTPS only, no embedded credentials. */
export const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(isSafeExternalUrl, "Informe um link https:// válido.");

export const slug = z.string().trim().max(80).regex(SLUG_RE, "Use apenas letras minúsculas, números e hífens.");
export const isoDateTime = z.iso.datetime({ offset: true });
export const isoDate = z.iso.date();
export const category = text(60);
