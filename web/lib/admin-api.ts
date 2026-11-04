"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

let csrfToken = "";
export const setCsrfToken = (t: string) => {
  csrfToken = t;
};

/**
 * Same-origin fetch to the API. The session lives in an HttpOnly cookie the browser sends
 * automatically; the CSRF token is kept only in memory and sent as a header.
 */
export async function apiFetch<T = unknown>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") headers["X-CSRF-Token"] = csrfToken;
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body ?? {});
  }
  const res = await fetch(`/api/v1${path}`, { method, headers, body, credentials: "same-origin", cache: "no-store" });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? "ERROR", err.message ?? "Não foi possível concluir a operação.", err.details);
  }
  return data as T;
}

export const admin = {
  get: <T>(p: string) => apiFetch<T>(`/admin${p}`),
  post: <T>(p: string, body?: unknown) => apiFetch<T>(`/admin${p}`, { method: "POST", body }),
  patch: <T>(p: string, body?: unknown) => apiFetch<T>(`/admin${p}`, { method: "PATCH", body }),
  put: <T>(p: string, body?: unknown) => apiFetch<T>(`/admin${p}`, { method: "PUT", body }),
  del: <T>(p: string) => apiFetch<T>(`/admin${p}`, { method: "DELETE" }),
  upload: <T>(p: string, form: FormData, method = "POST") => apiFetch<T>(`/admin${p}`, { method, form }),
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.details?.length) return `${err.message} ${err.details.map((d) => `${d.path ? `${d.path}: ` : ""}${d.message}`).join("; ")}`;
    return err.message;
  }
  return "Erro inesperado. Tente novamente.";
}

/** Only allow redirects to admin paths on this origin (prevents open redirects). */
export function safeAdminNext(next: string | null): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//") || next.includes("\\") || next.includes("://")) return "/admin";
  return next;
}
