import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { api } from "@/lib/api";
import { isPlaceholder } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const s = await api.settings();
  return {
    title: { default: s.seoTitle, template: `%s | ${s.shortName}` },
    description: isPlaceholder(s.seoDescription) ? undefined : s.seoDescription,
  };
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await api.settings();
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <SiteHeader shortName={settings.shortName} />
      <main id="conteudo">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
