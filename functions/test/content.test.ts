import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, clearFirestore, login, NEWS } from "./helpers";
import { COLLECTIONS, db } from "../src/lib/firebase";

describe("content RBAC, publication workflow and validation", () => {
  beforeEach(clearFirestore);

  it("editor creates drafts but cannot publish", async () => {
    const editor = await login("ed1", "EDITOR");
    const created = await editor.post("/api/v1/admin/news", NEWS);
    expect(created.status).toBe(201);
    const pub = await editor.post(`/api/v1/admin/news/${created.body.id}/publish`);
    expect(pub.status).toBe(403);
    const audit = await db.collection(COLLECTIONS.auditLogs).where("action", "==", "authz.denied").get();
    expect(audit.size).toBeGreaterThan(0);
  });

  it("editor cannot delete or archive content", async () => {
    const editor = await login("ed2", "EDITOR");
    const { body } = await editor.post("/api/v1/admin/news", NEWS);
    expect((await editor.del(`/api/v1/admin/news/${body.id}`)).status).toBe(403);
    expect((await editor.post(`/api/v1/admin/news/${body.id}/archive`)).status).toBe(403);
  });

  it("editor cannot reach user management, settings or audit", async () => {
    const editor = await login("ed3", "EDITOR");
    expect((await editor.get("/api/v1/admin/users")).status).toBe(403);
    expect((await editor.get("/api/v1/admin/audit")).status).toBe(403);
    expect((await editor.put("/api/v1/admin/settings", {})).status).toBe(403);
  });

  it("rejects mass assignment of protected fields", async () => {
    const editor = await login("ed4", "EDITOR");
    const res = await editor.post("/api/v1/admin/news", { ...NEWS, status: "published", createdBy: "someone" });
    expect(res.status).toBe(400);
  });

  it("drafts and scheduled content are invisible to the public", async () => {
    const pub = await login("pb1", "PUBLISHER");
    const draft = await pub.post("/api/v1/admin/news", { ...NEWS, title: "Rascunho secreto" });
    const scheduled = await pub.post("/api/v1/admin/news", { ...NEWS, title: "Agendada" });
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect((await pub.post(`/api/v1/admin/news/${scheduled.body.id}/publish`, { publishAt: future })).status).toBe(200);

    const list = await request(app).get("/api/v1/public/news");
    expect(list.body.items).toHaveLength(0);
    expect((await request(app).get("/api/v1/public/news/rascunho-secreto")).status).toBe(404);
    expect((await request(app).get("/api/v1/public/news/agendada")).status).toBe(404);
    void draft;
  });

  it("publisher publishes; public output is an allow-listed projection", async () => {
    const pub = await login("pb2", "PUBLISHER");
    const { body } = await pub.post("/api/v1/admin/news", NEWS);
    expect((await pub.post(`/api/v1/admin/news/${body.id}/publish`)).status).toBe(200);
    const res = await request(app).get("/api/v1/public/news/noticia-de-teste");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe(NEWS.title);
    expect(res.body.createdBy).toBeUndefined();
    expect(res.body.updatedBy).toBeUndefined();
    expect(res.body.status).toBeUndefined();
  });

  it("editor cannot modify content that is already live", async () => {
    const pub = await login("pb3", "PUBLISHER");
    const { body } = await pub.post("/api/v1/admin/news", NEWS);
    await pub.post(`/api/v1/admin/news/${body.id}/publish`);
    const editor = await login("ed5", "EDITOR");
    expect((await editor.patch(`/api/v1/admin/news/${body.id}`, { title: "Alterada" })).status).toBe(403);
  });

  it("updating published content stores a revision", async () => {
    const pub = await login("pb4", "PUBLISHER");
    const { body } = await pub.post("/api/v1/admin/news", NEWS);
    await pub.post(`/api/v1/admin/news/${body.id}/publish`);
    expect((await pub.patch(`/api/v1/admin/news/${body.id}`, { title: "Nova versão" })).status).toBe(200);
    const revs = await db.collection(COLLECTIONS.revisions).where("resourceId", "==", body.id).get();
    expect(revs.size).toBe(1);
  });

  it("sanitises stored XSS payloads in rich text and plain fields", async () => {
    const pub = await login("pb5", "PUBLISHER");
    const { body } = await pub.post("/api/v1/admin/news", {
      ...NEWS,
      title: "<img src=x onerror=alert(1)>Título",
      contentHtml:
        '<p onclick="alert(1)">ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>' +
        '<img src="https://evil.example/t.png"><iframe src="https://evil.example"></iframe><a href="https://ok.example">l</a>',
    });
    const doc = (await db.collection(COLLECTIONS.news).doc(body.id).get()).data()!;
    expect(doc.title).toBe("Título");
    expect(doc.contentHtml).not.toMatch(/script|onclick|onerror|javascript:|iframe|evil\.example\/t\.png/i);
    expect(doc.contentHtml).toContain('rel="noopener noreferrer nofollow"');
  });

  it("treats NoSQL-style operator payloads as invalid input", async () => {
    const editor = await login("ed6", "EDITOR");
    const res = await editor.post("/api/v1/admin/news", { ...NEWS, title: { $gt: "" } });
    expect(res.status).toBe(400);
    const slugProbe = await request(app).get("/api/v1/public/news/' OR 1=1 --");
    expect(slugProbe.status).toBe(404);
  });

  it("never lets a CDN cache error responses from public routes", async () => {
    const res = await request(app).get("/api/v1/public/news/nao-existe");
    expect(res.status).toBe(404);
    expect(res.headers["cache-control"]).toBe("no-store");
    const ok = await request(app).get("/api/v1/public/settings");
    expect(ok.headers["cache-control"]).toContain("s-maxage");
  });

  it("rejects manipulated identifiers", async () => {
    const editor = await login("ed7", "EDITOR");
    expect((await editor.get("/api/v1/admin/news/..%2F..%2FadminUsers")).status).toBe(404);
    expect((await editor.get("/api/v1/admin/news/nonexistent-id-123")).status).toBe(404);
  });

  it("paginates with server-side limits", async () => {
    const pub = await login("pb6", "PUBLISHER");
    for (let i = 0; i < 3; i++) {
      const { body } = await pub.post("/api/v1/admin/news", { ...NEWS, title: `Notícia ${i}` });
      await pub.post(`/api/v1/admin/news/${body.id}/publish`);
    }
    const res = await request(app).get("/api/v1/public/news?pageSize=2&page=2");
    expect(res.body.items).toHaveLength(1);
    expect(res.body.totalPages).toBe(2);
    const huge = await request(app).get("/api/v1/public/news?pageSize=100000");
    expect(huge.body.pageSize).toBeLessThanOrEqual(24);
  });
});
