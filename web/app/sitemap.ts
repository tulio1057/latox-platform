import type { MetadataRoute } from "next";
import { api } from "@/lib/api";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const data = await api.sitemap();
  const staticPages = ["", "/sobre", "/equipe", "/projetos", "/eventos", "/noticias", "/processo-seletivo", "/contato", "/privacidade"];
  const map = (prefix: string, items: { slug: string; updatedAt: string }[] = []) =>
    items.map((i) => ({ url: `${base}${prefix}/${i.slug}`, lastModified: i.updatedAt ? new Date(i.updatedAt) : undefined }));
  return [
    ...staticPages.map((p) => ({ url: `${base}${p}` })),
    ...map("/noticias", data.news),
    ...map("/projetos", data.projects),
    ...map("/eventos", data.events),
    ...map("/processo-seletivo", data.selectionProcesses),
  ];
}
