import Busboy from "busboy";
import type { Request } from "express";
import sharp from "sharp";
import { config } from "../config";
import { badRequest, HttpError } from "./errors";

export type MediaKind = "image" | "pdf";

interface Detected {
  kind: MediaKind;
  format: "jpeg" | "png" | "webp" | "pdf";
}

const ALLOWED_EXTENSIONS: Record<string, Detected["format"]> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  pdf: "pdf",
};

const DECLARED_MIME: Record<Detected["format"], string[]> = {
  jpeg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  pdf: ["application/pdf"],
};

/** Identifies the real file type from its signature (magic bytes), ignoring the client's claims. */
export function detectFormat(buf: Buffer): Detected | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: "image", format: "jpeg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { kind: "image", format: "png" };
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return { kind: "image", format: "webp" };
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return { kind: "pdf", format: "pdf" };
  return null;
}

/** PDF features that can execute code or smuggle payloads. Heuristic, not an antivirus. */
const PDF_DANGEROUS = [/\/JavaScript\b/, /\/JS\b/, /\/Launch\b/, /\/EmbeddedFile\b/, /\/RichMedia\b/, /\/XFA\b/];

export interface ProcessedFile {
  buffer: Buffer;
  kind: MediaKind;
  mimeType: string;
  ext: string;
  width?: number;
  height?: number;
}

export async function validateAndProcess(input: Buffer, filename: string, declaredMime: string): Promise<ProcessedFile> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const expected = ALLOWED_EXTENSIONS[ext];
  if (!expected) throw badRequest("Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou PDF.");
  if (input.length === 0) throw badRequest("Arquivo vazio.");
  const detected = detectFormat(input);
  if (!detected || detected.format !== expected) throw badRequest("O conteúdo do arquivo não corresponde à extensão.");
  if (!DECLARED_MIME[detected.format].includes(declaredMime.toLowerCase())) throw badRequest("Tipo MIME inconsistente.");

  if (detected.kind === "pdf") {
    const latin = input.toString("latin1");
    if (PDF_DANGEROUS.some((re) => re.test(latin))) {
      throw badRequest("PDF recusado: contém conteúdo ativo (scripts, anexos ou formulários dinâmicos).");
    }
    return { buffer: input, kind: "pdf", mimeType: "application/pdf", ext: "pdf" };
  }

  // Re-encode every image: removes EXIF/GPS metadata and anything appended to the file,
  // normalises orientation and bounds dimensions. Pixel limit guards against decompression bombs.
  try {
    const { data, info } = await sharp(input, { limitInputPixels: config.limits.imageMaxPixels, failOn: "error" })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, kind: "image", mimeType: "image/webp", ext: "webp", width: info.width, height: info.height };
  } catch {
    throw badRequest("Imagem inválida ou corrompida.");
  }
}

export interface ParsedUpload {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  fields: Record<string, string>;
}

/** Parses a single-file multipart body with strict limits. */
export function parseMultipart(req: Request): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    let bb: Busboy.Busboy;
    try {
      bb = Busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: config.limits.uploadBytes, fields: 6, fieldSize: 1024, parts: 8 },
      });
    } catch {
      reject(badRequest("Envie o arquivo como multipart/form-data."));
      return;
    }
    const fields: Record<string, string> = {};
    let file: ParsedUpload | null = null;
    let failed: Error | null = null;

    bb.on("field", (name, value) => {
      fields[name] = value;
    });
    bb.on("file", (_name, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("limit", () => {
        failed = new HttpError(413, "FILE_TOO_LARGE", `Arquivo excede o tamanho máximo de ${Math.round(config.limits.uploadBytes / 1048576)} MB.`);
        stream.resume();
      });
      stream.on("end", () => {
        file = {
          buffer: Buffer.concat(chunks),
          filename: (info.filename ?? "").slice(0, 200),
          mimeType: info.mimeType ?? "",
          fields,
        };
      });
    });
    bb.on("filesLimit", () => (failed = badRequest("Envie apenas um arquivo por vez.")));
    bb.on("error", () => reject(badRequest("Upload malformado.")));
    bb.on("close", () => {
      if (failed) return reject(failed);
      if (!file) return reject(badRequest("Nenhum arquivo enviado."));
      resolve({ ...(file as ParsedUpload), fields });
    });

    if (req.rawBody) bb.end(req.rawBody);
    else req.pipe(bb);
  });
}

/** Human-friendly display name; never used as a storage path. */
export function displayName(original: string): string {
  const base = original.replace(/[\\/]/g, "_").replace(/[^\p{L}\p{N}._ -]/gu, "").trim();
  return base.slice(0, 120) || "arquivo";
}
