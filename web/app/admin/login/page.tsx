"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SignInFlow } from "@/components/admin/SignInFlow";
import { safeAdminNext, setCsrfToken } from "@/lib/admin-api";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeAdminNext(params.get("next"));
  return (
    <SignInFlow
      onDone={(r) => {
        setCsrfToken(r.csrfToken);
        router.replace(next);
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <img src="/brand/emblem.webp" alt="" width={70} height={88} style={{ margin: "0 auto 8px", mixBlendMode: "multiply" }} />
        <h1>Painel LATox</h1>
        <p className="muted" style={{ textAlign: "center" }}>
          Acesso restrito a administradores autorizados.
        </p>
        <Suspense>
          <LoginInner />
        </Suspense>
        <p className="login-foot">
          Contas são criadas apenas por convite. <Link href="/">Voltar ao site</Link>
        </p>
      </div>
    </main>
  );
}
