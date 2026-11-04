"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, ApiError, setCsrfToken } from "@/lib/admin-api";
import type { Me, Permission } from "@/lib/admin-config";
import { SignInFlow } from "./SignInFlow";

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface AdminCtx {
  me: Me;
  can: (p: Permission) => boolean;
  toast: (kind: Toast["kind"], text: string) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** Runs an API call; if the server demands re-authentication, prompts and retries once. */
  withReauth: <T>(fn: () => Promise<T>) => Promise<T>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AdminCtx | null>(null);

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin outside AdminProvider");
  return c;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [reauth, setReauth] = useState<{ resolve: (ok: boolean) => void } | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const reauthRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    apiFetch<{ user: Me; csrfToken: string }>("/auth/me")
      .then((r) => {
        setCsrfToken(r.csrfToken);
        setMe(r.user);
      })
      .catch(() => router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`));
  }, [router, pathname]);

  useEffect(() => {
    if (confirmState) confirmRef.current?.showModal();
    else confirmRef.current?.close();
  }, [confirmState]);
  useEffect(() => {
    if (reauth) reauthRef.current?.showModal();
    else reauthRef.current?.close();
  }, [reauth]);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })), []);

  const withReauth = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") {
        const ok = await new Promise<boolean>((resolve) => setReauth({ resolve }));
        if (!ok) throw new ApiError(403, "REAUTH_CANCELLED", "Operação cancelada.");
        return fn();
      }
      if (err instanceof ApiError && err.status === 401) {
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      }
      throw err;
    }
  }, [router, pathname]);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    setCsrfToken("");
    router.replace("/admin/login");
  }, [router]);

  if (!me) {
    return (
      <div className="admin-loading" role="status">
        <span className="spinner" aria-hidden="true" /> Carregando painel…
      </div>
    );
  }

  const value: AdminCtx = { me, can: (p) => me.permissions.includes(p), toast, confirm, withReauth, logout };

  return (
    <Ctx.Provider value={value}>
      {children}

      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
            {t.text}
          </div>
        ))}
      </div>

      <dialog
        ref={confirmRef}
        className="modal"
        aria-labelledby="confirm-title"
        onCancel={(e) => {
          e.preventDefault();
          confirmState?.resolve(false);
          setConfirmState(null);
        }}
      >
        {confirmState && (
          <div className="modal-body">
            <h2 id="confirm-title">{confirmState.title}</h2>
            <div>{confirmState.body}</div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
              >
                Cancelar
              </button>
              <button
                className={`btn ${confirmState.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
              >
                {confirmState.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={reauthRef}
        className="modal"
        aria-labelledby="reauth-title"
        onCancel={(e) => {
          e.preventDefault();
          reauth?.resolve(false);
          setReauth(null);
        }}
      >
        {reauth && (
          <div className="modal-body">
            <h2 id="reauth-title">Confirme sua identidade</h2>
            <p className="muted">Esta é uma operação sensível. Informe sua senha e o código do autenticador.</p>
            <SignInFlow
              initialEmail={me.email ?? ""}
              lockEmail
              submitLabel="Confirmar identidade"
              onToken={async (idToken) => {
                const r = await apiFetch<{ csrfToken: string }>("/auth/reauth", { method: "POST", body: { idToken } });
                setCsrfToken(r.csrfToken);
                reauth.resolve(true);
                setReauth(null);
              }}
            />
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  reauth.resolve(false);
                  setReauth(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </dialog>
    </Ctx.Provider>
  );
}
