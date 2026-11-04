import Link from "next/link";
import { Molecule } from "@/components/decor";

export default function NotFound() {
  return (
    <main id="conteudo" style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <Molecule size={96} style={{ color: "var(--olive-600)", margin: "0 auto 12px" }} />
        <h1>Página não encontrada</h1>
        <p className="lead" style={{ margin: "0 auto 24px" }}>
          O conteúdo que você procura não existe ou ainda não foi publicado.
        </p>
        <Link href="/" className="btn btn-primary">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
