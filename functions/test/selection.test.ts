import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, clearFirestore, login } from "./helpers";
import { COLLECTIONS, db } from "../src/lib/firebase";

const PROCESS = {
  title: "Processo Seletivo 2027",
  summary: "Resumo",
  descriptionHtml: "<p>Descrição</p>",
  phase: "em_breve",
  registrationUrl: "https://forms.gle/exemplo",
  requirements: ["Estar matriculado"],
};

describe("selection processes and results", () => {
  beforeEach(clearFirestore);

  it("only exposes the registration link while registrations are open", async () => {
    const pub = await login("sp1", "PUBLISHER");
    const { body } = await pub.post("/api/v1/admin/selection-processes", PROCESS);
    await pub.post(`/api/v1/admin/selection-processes/${body.id}/publish`);
    let res = await request(app).get("/api/v1/public/selection-processes/processo-seletivo-2027");
    expect(res.body.registrationUrl).toBeNull();
    await pub.patch(`/api/v1/admin/selection-processes/${body.id}`, { phase: "inscricoes_abertas" });
    res = await request(app).get("/api/v1/public/selection-processes/processo-seletivo-2027");
    expect(res.body.registrationUrl).toBe("https://forms.gle/exemplo");
  });

  it("rejects unsafe registration links", async () => {
    const pub = await login("sp2", "PUBLISHER");
    for (const url of ["javascript:alert(1)", "http://forms.example.com", "https://user:pw@evil.example", "//evil.example"]) {
      const res = await pub.post("/api/v1/admin/selection-processes", { ...PROCESS, registrationUrl: url });
      expect(res.status, url).toBe(400);
    }
  });

  it("results never accept personal data fields", async () => {
    const editor = await login("sp3", "EDITOR");
    const pub = await login("sp3p", "PUBLISHER");
    const { body } = await pub.post("/api/v1/admin/selection-processes", PROCESS);
    const res = await editor.post(`/api/v1/admin/selection-processes/${body.id}/results`, {
      type: "preliminar",
      title: "Resultado preliminar",
      entries: [{ protocol: "2027-001", situation: "Aprovado", cpf: "000.000.000-00" }],
    });
    expect(res.status).toBe(400);
  });

  it("publication requires permission and explicit confirmation; replacement is audited", async () => {
    const editor = await login("sp4", "EDITOR");
    const pub = await login("sp4p", "PUBLISHER");
    const proc = await pub.post("/api/v1/admin/selection-processes", PROCESS);
    await pub.post(`/api/v1/admin/selection-processes/${proc.body.id}/publish`);
    const result = await editor.post(`/api/v1/admin/selection-processes/${proc.body.id}/results`, {
      type: "final",
      title: "Resultado final",
      entries: [{ protocol: "2027-001", position: 1, situation: "Aprovado" }],
    });
    expect(result.status).toBe(201);
    const rid = result.body.id as string;

    expect((await editor.post(`/api/v1/admin/results/${rid}/publish`, { confirm: true })).status).toBe(403);
    expect((await pub.post(`/api/v1/admin/results/${rid}/publish`, {})).status).toBe(400);

    let publicView = await request(app).get("/api/v1/public/selection-processes/processo-seletivo-2027");
    expect(publicView.body.results).toHaveLength(0);

    expect((await pub.post(`/api/v1/admin/results/${rid}/publish`, { confirm: true })).status).toBe(200);
    publicView = await request(app).get("/api/v1/public/selection-processes/processo-seletivo-2027");
    expect(publicView.body.results).toHaveLength(1);
    expect(publicView.body.results[0].entries[0]).toEqual({ protocol: "2027-001", position: 1, situation: "Aprovado" });

    expect((await editor.patch(`/api/v1/admin/results/${rid}`, { title: "x".repeat(10) })).status).toBe(403);
    expect((await pub.patch(`/api/v1/admin/results/${rid}`, { title: "Resultado final (retificado)" })).status).toBe(200);
    const audit = await db.collection(COLLECTIONS.auditLogs).where("action", "==", "result.replace").get();
    expect(audit.docs.some((d) => d.data().result === "success")).toBe(true);
    const revs = await db.collection(COLLECTIONS.revisions).where("resourceId", "==", rid).get();
    expect(revs.size).toBe(1);
  });
});
