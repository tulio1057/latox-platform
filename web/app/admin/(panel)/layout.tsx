"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminProvider, useAdmin } from "@/components/admin/AdminProvider";
import { IconMenu } from "@/components/icons";
import { ROLE_LABELS, type Permission } from "@/lib/admin-config";

const NAV: { group: string; items: { href: string; label: string; perm: Permission }[] }[] = [
  { group: "Geral", items: [{ href: "/admin", label: "Dashboard", perm: "content:read" }] },
  {
    group: "Conteúdo",
    items: [
      { href: "/admin/conteudo/noticias", label: "Notícias", perm: "content:read" },
      { href: "/admin/conteudo/projetos", label: "Projetos", perm: "content:read" },
      { href: "/admin/conteudo/eventos", label: "Eventos", perm: "content:read" },
      { href: "/admin/conteudo/equipe", label: "Equipe", perm: "content:read" },
      { href: "/admin/conteudo/processos", label: "Processos seletivos", perm: "content:read" },
      { href: "/admin/midia", label: "Arquivos", perm: "content:read" },
    ],
  },
  {
    group: "Administração",
    items: [
      { href: "/admin/configuracoes", label: "Configurações", perm: "content:read" },
      { href: "/admin/usuarios", label: "Administradores", perm: "users:manage" },
      { href: "/admin/auditoria", label: "Auditoria", perm: "audit:read" },
    ],
  },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { me, can, logout } = useAdmin();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <strong>Painel LATox</strong>
        <button className="menu-toggle" style={{ display: "inline-flex" }} aria-expanded={open} aria-controls="admin-sidebar" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
          <IconMenu />
        </button>
      </div>
      <aside id="admin-sidebar" className="admin-sidebar" data-open={open}>
        <Link href="/admin" className="admin-brand">
          <img src="/brand/emblem.webp" alt="" />
          <span className="brand-text">
            <strong>LATox</strong>
            <span>Painel</span>
          </span>
        </Link>
        <nav className="admin-nav" aria-label="Painel">
          {NAV.map((g) => {
            const items = g.items.filter((i) => can(i.perm));
            if (!items.length) return null;
            return (
              <div key={g.group}>
                <div className="group">{g.group}</div>
                {items.map((i) => (
                  <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}>
                    {i.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="admin-user">
          <strong>{me.name || me.email}</strong>
          <span>{ROLE_LABELS[me.role]}</span>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-light btn-sm">
              Ver site
            </a>
            <button className="btn btn-sm btn-outline" style={{ color: "var(--cream-100)", borderColor: "var(--sage-400)" }} onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </div>
      </aside>
      <main className="admin-main" id="conteudo">
        {children}
      </main>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <Shell>{children}</Shell>
    </AdminProvider>
  );
}
