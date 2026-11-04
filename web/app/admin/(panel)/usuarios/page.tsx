"use client";

import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { admin, errorMessage } from "@/lib/admin-api";
import { ROLE_LABELS, type Role } from "@/lib/admin-config";
import { getClientAuth } from "@/lib/firebase-client";
import { formatDateTime } from "@/lib/format";

interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  mfaEnrolled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_HELP: Record<Role, string> = {
  SUPER_ADMIN: "Controle total: usuários, permissões, configurações, auditoria.",
  PUBLISHER: "Revisa e publica conteúdos e resultados.",
  EDITOR: "Cria e edita rascunhos, envia imagens. Não publica.",
};

export default function UsersPage() {
  const { me, can, toast, confirm, withReauth } = useAdmin();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [form, setForm] = useState({ email: "", name: "", role: "EDITOR" as Role });
  const [sessions, setSessions] = useState<{ uid: string; items: { createdAt: string; lastSeenAt: string; userAgent: string }[] } | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers((await admin.get<{ items: AdminUser[] }>("/users")).items);
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }, [toast]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!can("users:manage")) return <div className="alert alert-error">Acesso restrito a Super Admins.</div>;

  async function invite(e: FormEvent) {
    e.preventDefault();
    try {
      await withReauth(() => admin.post("/users", form));
      // Firebase e-mails the invitee a one-time link to define their own password.
      await sendPasswordResetEmail(getClientAuth(), form.email).catch(() => undefined);
      toast("success", `Convite enviado para ${form.email}. A pessoa definirá a senha pelo link recebido e configurará o 2FA no primeiro acesso.`);
      setForm({ email: "", name: "", role: "EDITOR" });
      await load();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  async function op(u: AdminUser, label: string, fn: () => Promise<unknown>, danger = false) {
    const ok = await confirm({ title: `${label}?`, body: `${u.name} (${u.email})`, confirmLabel: label, danger });
    if (!ok) return;
    try {
      await withReauth(fn);
      toast("success", "Operação concluída.");
      await load();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  return (
    <>
      <div className="admin-page-head">
        <h1>Administradores</h1>
      </div>

      <section className="panel" aria-labelledby="inv-h">
        <h2 id="inv-h">Convidar administrador</h2>
        <form className="form-2col" onSubmit={invite}>
          <div className="field">
            <label htmlFor="inv-name">Nome</label>
            <input id="inv-name" className="input" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="inv-email">E-mail institucional</label>
            <input id="inv-email" className="input" type="email" required maxLength={200} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="inv-role">Perfil de acesso</label>
            <select id="inv-role" className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <span className="help">{ROLE_HELP[form.role]}</span>
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <button className="btn btn-primary" type="submit">
              Enviar convite
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Perfil</th>
                <th scope="col">Status</th>
                <th scope="col">Último acesso</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!users ? (
                <tr>
                  <td colSpan={5}>Carregando…</td>
                </tr>
              ) : (
                users.map((u) => {
                  const self = u.uid === me.uid;
                  return (
                    <tr key={u.uid}>
                      <td>
                        <strong>{u.name}</strong> {self && <span className="badge">você</span>}
                        <div className="muted" style={{ fontSize: "0.82rem" }}>
                          {u.email}
                        </div>
                        <div style={{ fontSize: "0.78rem" }}>{u.mfaEnrolled ? "✓ 2FA ativo" : "⚠ 2FA pendente (será exigido no 1º acesso)"}</div>
                      </td>
                      <td>
                        {self ? (
                          ROLE_LABELS[u.role]
                        ) : (
                          <select
                            className="select"
                            aria-label={`Perfil de ${u.name}`}
                            value={u.role}
                            onChange={(e) => {
                              const role = e.target.value as Role;
                              void op(u, `Alterar perfil para ${ROLE_LABELS[role]}`, () => admin.patch(`/users/${u.uid}/role`, { role }));
                            }}
                          >
                            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{u.status === "active" ? <span className="badge badge-success">Ativo</span> : <span className="badge badge-danger">Suspenso</span>}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}</td>
                      <td>
                        <div className="row-actions">
                          {!self &&
                            (u.status === "active" ? (
                              <button className="btn btn-ghost btn-sm" onClick={() => void op(u, "Suspender acesso", () => admin.post(`/users/${u.uid}/suspend`), true)}>
                                Suspender
                              </button>
                            ) : (
                              <button className="btn btn-ghost btn-sm" onClick={() => void op(u, "Reativar acesso", () => admin.post(`/users/${u.uid}/reactivate`))}>
                                Reativar
                              </button>
                            ))}
                          {!self && u.mfaEnrolled && (
                            <button
                              className="btn btn-ghost btn-sm"
                              title="Use quando a pessoa perder o celular e os códigos de recuperação. Confirme a identidade dela por outro canal antes."
                              onClick={() => void op(u, "Redefinir autenticação em dois fatores", () => admin.post(`/users/${u.uid}/reset-mfa`), true)}
                            >
                              Redefinir 2FA
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => void op(u, "Revogar todas as sessões", () => admin.post(`/users/${u.uid}/revoke-sessions`), true)}>
                            Revogar sessões
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              try {
                                const r = await admin.get<{ items: { createdAt: string; lastSeenAt: string; userAgent: string }[] }>(`/users/${u.uid}/sessions`);
                                setSessions({ uid: u.uid, items: r.items });
                              } catch (e) {
                                toast("error", errorMessage(e));
                              }
                            }}
                          >
                            Sessões
                          </button>
                          {can("audit:read") && (
                            <Link className="btn btn-ghost btn-sm" href={`/admin/auditoria?actorUid=${encodeURIComponent(u.uid)}`}>
                              Atividades
                            </Link>
                          )}
                        </div>
                        {sessions?.uid === u.uid && (
                          <ul style={{ fontSize: "0.8rem", margin: "8px 0 0", paddingLeft: 18 }}>
                            {sessions.items.length === 0 && <li>Nenhuma sessão ativa.</li>}
                            {sessions.items.map((s, i) => (
                              <li key={i}>
                                Início {formatDateTime(s.createdAt)} · último uso {formatDateTime(s.lastSeenAt)} · {s.userAgent.slice(0, 60)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
          Ninguém pode alterar o próprio perfil. Alterações de perfil, suspensões e convites exigem confirmação de identidade e encerram as sessões da pessoa afetada.
        </p>
      </section>
    </>
  );
}
