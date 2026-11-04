import type { Metadata } from "next";
import { IconInstagram, IconMail, IconPin } from "@/components/icons";
import { EmptyState, PageHero } from "@/components/ui";
import { api } from "@/lib/api";
import { isPlaceholder, safeHref } from "@/lib/format";

export const revalidate = 60;
export const metadata: Metadata = { title: "Contato", description: "Canais oficiais de contato da LATox." };

export default async function ContactPage() {
  const s = await api.settings();
  const instagram = safeHref(s.instagramUrl);
  const links = s.socialLinks.map((l) => ({ ...l, href: safeHref(l.url) })).filter((l) => l.href);
  const hasAny = s.contactEmail || instagram || (s.address && !isPlaceholder(s.address)) || links.length;

  return (
    <>
      <PageHero eyebrow="Contato" title="Fale com a LATox" lead="Utilize os canais oficiais abaixo para dúvidas, parcerias e convites." />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {!hasAny ? (
            <EmptyState title="Canais oficiais em atualização">Os contatos oficiais da liga serão publicados em breve.</EmptyState>
          ) : (
            <div className="grid grid-3">
              {s.contactEmail && (
                <a className="shortcut" href={`mailto:${s.contactEmail}`}>
                  <IconMail className="shortcut-icon" size={40} />
                  <h3>E-mail</h3>
                  <p>{s.contactEmail}</p>
                </a>
              )}
              {instagram && (
                <a className="shortcut" href={instagram} target="_blank" rel="noopener noreferrer">
                  <IconInstagram className="shortcut-icon" size={40} />
                  <h3>Instagram</h3>
                  <p>{new URL(instagram).pathname.replace(/\//g, "") ? `@${new URL(instagram).pathname.replace(/\//g, "")}` : "Perfil oficial"}</p>
                </a>
              )}
              {s.address && !isPlaceholder(s.address) && (
                <div className="shortcut" style={{ cursor: "default" }}>
                  <IconPin className="shortcut-icon" size={40} />
                  <h3>Localização</h3>
                  <p>{s.address}</p>
                </div>
              )}
              {links.map((l) => (
                <a key={l.href} className="shortcut" href={l.href!} target="_blank" rel="noopener noreferrer">
                  <h3>{l.label}</h3>
                  <p>{new URL(l.href!).hostname}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
