"use client";

import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/admin-api";
import { getClientAuth } from "@/lib/firebase-client";

type Step = "credentials" | "verify" | "enroll" | "recovery-codes" | "reset";

interface Challenge {
  mfa: "verify" | "enroll";
  challenge: string;
  otpauthUrl?: string;
  secret?: string;
}

interface MfaResult {
  csrfToken: string;
  recoveryCodes?: string[];
}

/** Generic messages only: never reveal whether an account exists. */
function friendly(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "auth/too-many-requests") return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (err instanceof ApiError) return err.message;
  return "Não foi possível entrar. Verifique seus dados.";
}

/**
 * Two steps:
 *  1. password, verified by Firebase Auth in the browser → short-lived ID token,
 *     exchanged at the API for a second-factor challenge (never a session);
 *  2. TOTP code from an authenticator app (or a one-time recovery code), verified by the API.
 * Firebase client state is in memory only and cleared right after step 1.
 */
export function SignInFlow({
  mode = "login",
  initialEmail = "",
  onDone,
}: {
  mode?: "login" | "reauth";
  initialEmail?: string;
  onDone: (result: MfaResult) => void | Promise<void>;
}) {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [qr, setQr] = useState("");
  const [result, setResult] = useState<MfaResult | null>(null);

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
      let idToken: string;
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        idToken = await cred.user.getIdToken(true);
      } finally {
        setPassword("");
        await signOut(auth).catch(() => undefined);
      }
      const ch = await apiFetch<Challenge>(mode === "reauth" ? "/auth/reauth" : "/auth/session", { method: "POST", body: { idToken } });
      setChallenge(ch);
      if (ch.mfa === "enroll" && ch.otpauthUrl) {
        setQr(await QRCode.toDataURL(ch.otpauthUrl, { margin: 1, width: 220, color: { dark: "#26351B", light: "#FFFFFF" } }));
        setStep("enroll");
      } else {
        setStep("verify");
      }
    });
  };

  const onCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (!challenge) return;
      const body = useRecovery ? { challenge: challenge.challenge, recoveryCode: code.trim() } : { challenge: challenge.challenge, code: code.trim() };
      try {
        const r = await apiFetch<MfaResult>("/auth/mfa", { method: "POST", body });
        setCode("");
        if (r.recoveryCodes?.length) {
          setResult(r);
          setStep("recovery-codes");
          return;
        }
        await onDone(r);
      } catch (err) {
        // An expired/locked challenge cannot be retried: start over.
        if (err instanceof ApiError && err.code === "MFA_INVALID") setCode("");
        throw err;
      }
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

  const restart = () => {
    setChallenge(null);
    setCode("");
    setQr("");
    setUseRecovery(false);
    setStep("credentials");
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
        <form onSubmit={onCredentials} className="form-grid">
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" className="input" type="email" autoComplete="username" required value={email} readOnly={mode === "reauth"} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" className="input" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            {busy ? "Verificando…" : mode === "reauth" ? "Continuar" : "Entrar"}
          </button>
          {mode === "login" && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("reset")}>
              Esqueci minha senha
            </button>
          )}
        </form>
      )}

      {(step === "verify" || step === "enroll") && (
        <form onSubmit={onCode} className="form-grid">
          {step === "enroll" ? (
            <>
              <div className="alert alert-info">
                A autenticação em dois fatores é obrigatória. Escaneie o QR code com um aplicativo autenticador (Google Authenticator,
                Microsoft Authenticator, 1Password…) e digite o código de 6 dígitos gerado.
              </div>
              {qr && <img src={qr} alt="QR code para configurar o aplicativo autenticador" width={220} height={220} style={{ margin: "0 auto", borderRadius: 12 }} />}
              {challenge?.secret && (
                <details>
                  <summary>Não consegue escanear? Use a chave manual</summary>
                  <code style={{ wordBreak: "break-all" }}>{challenge.secret}</code>
                </details>
              )}
            </>
          ) : (
            <p className="muted mt-0">{useRecovery ? "Digite um dos seus códigos de recuperação." : "Digite o código de 6 dígitos do seu aplicativo autenticador."}</p>
          )}
          <div className="field">
            <label htmlFor="otp">{useRecovery ? "Código de recuperação" : "Código de verificação"}</label>
            {useRecovery ? (
              <input id="otp" className="input" autoComplete="off" required maxLength={20} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            ) : (
              <input id="otp" className="input otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            )}
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy || (!useRecovery && code.length !== 6)}>
            {busy ? "Verificando…" : step === "enroll" ? "Ativar e entrar" : "Confirmar"}
          </button>
          {step === "verify" && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setUseRecovery((v) => !v), setCode(""))}>
              {useRecovery ? "Usar o aplicativo autenticador" : "Perdi o acesso ao autenticador"}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
            Recomeçar
          </button>
        </form>
      )}

      {step === "recovery-codes" && result && (
        <div className="form-grid">
          <div className="alert alert-warn">
            <strong>Guarde estes códigos de recuperação agora.</strong> Cada um funciona uma única vez, caso você perca o celular. Eles não
            serão mostrados novamente.
          </div>
          <pre style={{ background: "var(--beige-200)", padding: 16, borderRadius: 8, fontSize: "1.05rem", textAlign: "center" }}>{result.recoveryCodes!.join("\n")}</pre>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => void navigator.clipboard.writeText(result.recoveryCodes!.join("\n"))}>
            Copiar códigos
          </button>
          <button className="btn btn-primary btn-lg" type="button" onClick={() => void onDone(result)}>
            Já guardei, continuar
          </button>
        </div>
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
