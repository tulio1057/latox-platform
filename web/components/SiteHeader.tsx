"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/nav";
import { IconClose, IconMenu } from "./icons";

export function SiteHeader({ shortName }: { shortName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label={`${shortName} — página inicial`}>
          <img src="/brand/emblem.webp" alt="" width={43} height={54} />
          <span className="brand-text">
            <strong>{shortName}</strong>
            <span>Liga Acadêmica de Toxicologia</span>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Navegação principal">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-cta">
          <Link href="/processo-seletivo" className="btn btn-primary btn-sm">
            Participe da Liga
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <nav id="mobile-nav" className="mobile-nav" data-open={open} aria-label="Navegação principal (móvel)" hidden={!open}>
        <ul>
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/processo-seletivo" className="btn btn-primary btn-lg" style={{ width: "100%" }}>
          Participe da Liga
        </Link>
      </nav>
    </header>
  );
}
