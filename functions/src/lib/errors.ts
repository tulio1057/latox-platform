import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "firebase-functions";
import { ZodError } from "zod";
import { config } from "../config";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg = "Requisição inválida.", details?: unknown) =>
  new HttpError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Não autenticado.") => new HttpError(401, "UNAUTHENTICATED", msg);
export const forbidden = (msg = "Acesso negado.") => new HttpError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Recurso não encontrado.") => new HttpError(404, "NOT_FOUND", msg);
export const conflict = (msg: string) => new HttpError(409, "CONFLICT", msg);

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound());

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  void _next;
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos.",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // body-parser errors (malformed JSON, too large)
  const status = typeof err?.status === "number" ? err.status : 500;
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: { code: "BAD_REQUEST", message: "Requisição inválida." } });
    return;
  }
  logger.error("Unhandled error", { path: req.path, method: req.method, message: err?.message, stack: err?.stack });
  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: "Erro interno.",
      ...(config.isProduction ? {} : { debug: String(err?.message ?? err) }),
    },
  });
};
