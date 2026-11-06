import Link from "next/link";
import type { SiteSettings } from "@/lib/types";
import { isPlaceholder, safeHref } from "@/lib/format";
import { IconInstagram, IconMail } from "./icons";
import { NAV } from "@/lib/nav";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const instagram = safeHref(settings.instagramUrl);
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <img src={settings.logoUrl ?? "/brand/logo-latox.jpg"} alt={`Logo ${settings.shortName}`} className="footer-logo" width={140} height={140} />
          <p>{isPlaceholder(settings.footerText) ? settings.tagline : settings.footerText}</p>
          {!isPlaceholder(settings.institution) && <p>{settings.institution}</p>}
        </div>
        <div className="footer-nav">
          <h2>Navegação</h2>
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href}>{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Contato</h2>
          <ul>
            {settings.contactEmail && (
              <li>
                <a href={`mailto:${settings.contactEmail}`} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                  <IconMail size={18} /> {settings.contactEmail}
                </a>
              </li>
            )}
            {instagram && (
              <li>
                <a href={instagram} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                  <IconInstagram size={18} /> Instagram
                </a>
              </li>
            )}
            {settings.socialLinks.map((s) => {
              const href = safeHref(s.url);
              return href ? (
                <li key={href}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                </li>
              ) : null;
            })}
            {!settings.contactEmail && !instagram && <li>Canais oficiais em breve.</li>}
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {year} {settings.siteName} ({settings.shortName}). Todos os direitos reservados.
        </span>
        <Link href="/privacidade">Política de Privacidade</Link>
      </div>
    </footer>
  );
}
