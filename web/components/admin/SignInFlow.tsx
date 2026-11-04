"use client";

import {
  getMultiFactorResolver,
  multiFactor,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
} from "firebase/auth";
import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/admin-api";
import { getClientAuth } from "@/lib/firebase-client";

type Step = "credentials" | "totp" | "enroll" | "reset";

/** Generic messages only: never reveal whether an account exists. */
function friendly(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "auth/too-many-requests") return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (code === "auth/invalid-verification-code" || code === "auth/invalid-mfa-code") return "Código inválido. Confira o aplicativo autenticador.";
  if (err instanceof ApiError) return err.message;
  return "Não foi possível entrar. Verifique seus dados.";
}

/**
 * Password + TOTP second factor. On success calls `onToken(idToken)`, which the caller
 * exchanges for a server session (login) or a re-authentication (sensitive operations).
 * Firebase client state is cleared right after — the ID token is never stored.
 */
export function SignInFlow({
  initialEmail = "",
  lockEmail = false,
  submitLabel = "Entrar",
  onToken,
}: {
  initialEmail?: string;
  lockEmail?: boolean;
  submitLabel?: string;
  onToken: (idToken: string) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [enrollUser, setEnrollUser] = useState<User | null>(null);
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qr, setQr] = useState("");

  async function finish(user: User) {
    const auth = getClientAuth();
    let enrolling = false;
    try {
      const token = await user.getIdToken(true);
      await onToken(token);
    } catch (err) {
      if (err instanceof ApiError && err.code === "MFA_REQUIRED") {
        enrolling = true;
        await startEnrollment(user);
        return;
      }
      throw err;
    } finally {
      // Keep the Firebase user only while enrolling a second factor.
      if (!enrolling && auth.currentUser) await signOut(auth).catch(() => undefined);
    }
  }

  async function startEnrollment(user: User) {
    const session = await multiFactor(user).getSession();
    const s = await TotpMultiFactorGenerator.generateSecret(session);
    const uri = s.generateQrCodeUrl(user.email ?? email, "LATox Admin");
    setQr(await QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#26351B", light: "#FFFFFF" } }));
    setSecret(s);
    setEnrollUser(user);
    setStep("enroll");
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  const onCredentials = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const auth = getClientAuth();
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await finish(cred.user);
      } catch (err) {
        if ((err as { code?: string }).code === "auth/multi-factor-auth-required") {
          const r = getMultiFactorResolver(auth, err as MultiFactorError);
          if (!r.hints.some((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
            throw new Error("unsupported factor");
          }
          setResolver(r);
          setStep("totp");
          return;
        }
        throw err;
      } finally {
        setPassword("");
      }
    });
  };

  const onTotp = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (!resolver) return;
      const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)!;
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim());
      const cred = await resolver.resolveSignIn(assertion);
      setCode("");
      await finish(cred.user);
    });
  };

  const onEnroll = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (!enrollUser || !secret) return;
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
      await multiFactor(enrollUser).enroll(assertion, "Aplicativo autenticador");
      await signOut(getClientAuth());
      setSecret(null);
      setQr("");
      setCode("");
      setStep("credentials");
      setInfo("Autenticação em dois fatores ativada. Entre novamente usando sua senha e o código do aplicativo.");
    });
  };

  const onReset = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      try {
        await sendPasswordResetEmail(getClientAuth(), email.trim());
      } catch {
        /* same message regardless of outcome (no account enumeration) */
      }
      setStep("credentials");
      setInfo("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    });
  };

  return (
    <div className="stack">
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {info && (
        <div className="alert alert-info" role="status">
          {info}
        </div>
      )}

      {step === "credentials" && (
        <form onSubmit={onCredentials} className="form-grid" noValidate={false}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" className="input" type="email" autoComplete="username" required value={email} readOnly={lockEmail} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" className="input" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            {busy ? "Verificando…" : submitLabel}
          </button>
          {!lockEmail && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("reset")}>
              Esqueci minha senha
            </button>
          )}
        </form>
      )}

      {step === "totp" && (
        <form onSubmit={onTotp} className="form-grid">
          <p className="muted mt-0">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
          <div className="field">
            <label htmlFor="totp">Código de verificação</label>
            <input id="totp" className="input otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Verificando…" : "Confirmar"}
          </button>
        </form>
      )}

      {step === "enroll" && (
        <form onSubmit={onEnroll} className="form-grid">
          <div className="alert alert-info">
            A autenticação em dois fatores é obrigatória. Escaneie o QR code com um aplicativo autenticador (Google Authenticator,
            Microsoft Authenticator, 1Password…) e digite o código gerado.
          </div>
          {qr && <img src={qr} alt="QR code para configurar o aplicativo autenticador" width={220} height={220} style={{ margin: "0 auto", borderRadius: 12 }} />}
          {secret && (
            <details>
              <summary>Não consegue escanear? Use a chave manual</summary>
              <code style={{ wordBreak: "break-all" }}>{secret.secretKey}</code>
            </details>
          )}
          <div className="field">
            <label htmlFor="enroll-code">Código de verificação</label>
            <input id="enroll-code" className="input otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy || code.length !== 6}>
            Ativar autenticação em dois fatores
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={onReset} className="form-grid">
          <p className="muted mt-0">Informe seu e-mail. Se ele estiver cadastrado, enviaremos um link de redefinição.</p>
          <div className="field">
            <label htmlFor="reset-email">E-mail</label>
            <input id="reset-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Enviar link
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("credentials")}>
            Voltar
          </button>
        </form>
      )}
    </div>
  );
}
