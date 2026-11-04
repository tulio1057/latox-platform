import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProcessView } from "@/components/ProcessView";
import { api, ApiNotFound } from "@/lib/api";

export const revalidate = 60;

async function load(slug: string) {
  try {
    return await api.process(slug);
  } catch (e) {
    if (e instanceof ApiNotFound) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.title, description: p.summary } : {};
}

export default async function ProcessPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  return (
    <section className="section" style={{ paddingTop: 48 }}>
      <div className="container">
        <nav className="breadcrumb" aria-label="Trilha">
          <Link href="/processo-seletivo">Processo Seletivo</Link> / <span>{p.title}</span>
        </nav>
        <h1>{p.title}</h1>
        <p className="lead" style={{ marginBottom: 36 }}>
          {p.summary}
        </p>
        <ProcessView process={p} />
      </div>
    </section>
  );
}
