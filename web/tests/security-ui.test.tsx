import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { registrationLink, RegistrationButton } from "@/components/RegistrationCta";
import { parseEntries } from "@/components/admin/ResultsManager";
import { safeAdminNext } from "@/lib/admin-api";
import { isPlaceholder, safeHref } from "@/lib/format";
import { NAV } from "@/lib/nav";

describe("registration redirect (external form)", () => {
  it("only renders while registrations are open and a safe https link exists", () => {
    expect(registrationLink({ phase: "inscricoes_abertas", registrationUrl: "https://forms.gle/x" })).toBe("https://forms.gle/x");
    expect(registrationLink({ phase: "em_breve", registrationUrl: "https://forms.gle/x" })).toBeNull();
    expect(registrationLink({ phase: "inscricoes_abertas", registrationUrl: null })).toBeNull();
    expect(registrationLink({ phase: "inscricoes_abertas", registrationUrl: "javascript:alert(1)" })).toBeNull();
    expect(registrationLink({ phase: "inscricoes_abertas", registrationUrl: "http://forms.example.com" })).toBeNull();
  });

  it("opens in a new tab without opener access and warns about the third-party platform", () => {
    render(<RegistrationButton process={{ phase: "inscricoes_abertas", registrationUrl: "https://forms.gle/abc", title: "PS" }} />);
    const link = screen.getByRole("link", { name: /REALIZAR INSCRIÇÃO/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link.getAttribute("href")).toBe("https://forms.gle/abc");
    expect(screen.getByText(/plataforma externa \(forms\.gle\)/)).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<RegistrationButton process={{ phase: "finalizado", registrationUrl: "https://forms.gle/abc", title: "PS" }} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("link and redirect hardening", () => {
  it("safeHref only allows https and mailto", () => {
    expect(safeHref("https://instagram.com/latox")).toBe("https://instagram.com/latox");
    expect(safeHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("https://u:p@evil.example")).toBeNull();
  });

  it("post-login redirect cannot leave the admin area (open redirect)", () => {
    expect(safeAdminNext("/admin/midia")).toBe("/admin/midia");
    expect(safeAdminNext("https://evil.example")).toBe("/admin");
    expect(safeAdminNext("//evil.example")).toBe("/admin");
    expect(safeAdminNext("/admin\\..\\evil")).toBe("/admin");
    expect(safeAdminNext(null)).toBe("/admin");
  });

  it("placeholder texts are detected and never shown as official data", () => {
    expect(isPlaceholder("[PREENCHER] Missão")).toBe(true);
    expect(isPlaceholder("")).toBe(true);
    expect(isPlaceholder("Promover o estudo da toxicologia")).toBe(false);
  });
});

describe("results entry parsing", () => {
  it("parses protocol-only lines and never invents personal fields", () => {
    const rows = parseEntries("2027-001;1;Aprovado\n2027-002;Classificado\n\n");
    expect(rows).toEqual([
      { protocol: "2027-001", position: 1, situation: "Aprovado" },
      { protocol: "2027-002", situation: "Classificado" },
    ]);
  });
});

describe("navigation", () => {
  it("exposes all required public sections", () => {
    const labels = NAV.map((n) => n.label);
    for (const l of ["Início", "Sobre", "Projetos", "Eventos", "Notícias", "Processo Seletivo", "Contato"]) expect(labels).toContain(l);
  });
});
