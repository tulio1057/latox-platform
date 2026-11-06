"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV } from "@/lib/nav";
import { IconArrow, IconClose, IconMenu } from "./icons";

export function SiteHeader({ shortName }: { shortName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("menu-open");
    firstLinkRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("menu-open");
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="site-header" data-scrolled={scrolled || open}>
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
              ref={toggleRef}
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
      </header>

      {/* Outside <header>: its backdrop-filter would otherwise trap this fixed panel. */}
      <nav id="mobile-nav" className="mobile-nav" data-open={open} aria-label="Navegação principal (móvel)" hidden={!open}>
        <ul>
          {NAV.map((item, i) => (
            <li key={item.href}>
              <Link
                ref={i === 0 ? firstLinkRef : undefined}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <span>{item.label}</span>
                <IconArrow size={18} />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/processo-seletivo" className="btn btn-primary btn-lg btn-block" onClick={() => setOpen(false)}>
          Participe da Liga
        </Link>
      </nav>
    </>
  );
}
