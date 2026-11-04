import type { SelectionProcess } from "@/lib/types";
import { safeHref } from "@/lib/format";
import { IconExternal } from "./icons";

/** Returns the external form URL only if registrations are open AND the link is a safe https URL. */
export function registrationLink(process: Pick<SelectionProcess, "phase" | "registrationUrl">): string | null {
  if (process.phase !== "inscricoes_abertas") return null;
  const href = safeHref(process.registrationUrl);
  return href && href.startsWith("https://") ? href : null;
}

/**
 * "REALIZAR INSCRIÇÃO" — opens the official external form (Google/Microsoft Forms…)
 * in a new tab with noopener/noreferrer (no access to window.opener, no referrer leak).
 * No candidate data is ever appended to the URL.
 */
export function RegistrationButton({ process }: { process: Pick<SelectionProcess, "phase" | "registrationUrl" | "title"> }) {
  const href = registrationLink(process);
  if (!href) return null;
  let host = "";
  try {
    host = new URL(href).hostname;
  } catch {
    /* unreachable: validated above */
  }
  return (
    <div>
      <a
        className="btn btn-light btn-lg"
        href={href}
        target="_blank"
        rel="noopener noreferrer external"
        referrerPolicy="no-referrer"
        aria-describedby="external-form-note"
      >
        REALIZAR INSCRIÇÃO <IconExternal />
        <span className="sr-only">(abre o formulário externo em nova aba)</span>
      </a>
      <p className="external-note" id="external-form-note">
        A inscrição é feita em uma plataforma externa ({host}). Seus dados serão coletados por esse serviço, conforme
        nossa <a href="/privacidade">Política de Privacidade</a>.
      </p>
    </div>
  );
}
