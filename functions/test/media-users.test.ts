import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { app, clearFirestore, login, ORIGIN } from "./helpers";
import { COLLECTIONS, db } from "../src/lib/firebase";

async function pngWithMetadata() {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: "#26351B" } })
    .png()
    .withMetadata({ exif: { IFD0: { Copyright: "secret-gps-like-metadata" } } })
    .toBuffer();
}

const upload = (agent: Awaited<ReturnType<typeof login>>, buf: Buffer, filename: string, contentType: string, isPublic = "true") =>
  request(app)
    .post("/api/v1/admin/media")
    .set("Cookie", agent.cookie)
    .set("Origin", ORIGIN)
    .set("X-CSRF-Token", agent.csrf)
    .set("X-Forwarded-For", agent.ip)
    .field("isPublic", isPublic)
    .attach("file", buf, { filename, contentType });

describe("uploads", () => {
  beforeEach(clearFirestore);

  it("accepts a real image, strips metadata and re-encodes it", async () => {
    const editor = await login("m1", "EDITOR");
    const res = await upload(editor, await pngWithMetadata(), "foto.png", "image/png");
    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe("image/webp");
    const file = await request(app).get(`/api/v1/public/media/${res.body.id}`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    expect(file.headers["x-content-type-options"]).toBe("nosniff");
    expect((file.body as Buffer).toString("latin1")).not.toContain("secret-gps-like-metadata");
  });

  it("rejects files whose content does not match the extension", async () => {
    const editor = await login("m2", "EDITOR");
    const res = await upload(editor, Buffer.from("<script>alert(1)</script>"), "fake.png", "image/png");
    expect(res.status).toBe(400);
  });

  it("rejects executables and disallowed extensions", async () => {
    const editor = await login("m3", "EDITOR");
    expect((await upload(editor, Buffer.from("MZ\x90\x00"), "virus.exe", "application/octet-stream")).status).toBe(400);
    expect((await upload(editor, Buffer.from("<svg onload=alert(1)>"), "x.svg", "image/svg+xml")).status).toBe(400);
    expect((await upload(editor, Buffer.from("<?php system($_GET[1]);"), "shell.php.png", "image/png")).status).toBe(400);
  });

  it("rejects PDFs with active content", async () => {
    const editor = await login("m4", "EDITOR");
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\n%%EOF");
    expect((await upload(editor, pdf, "edital.pdf", "application/pdf")).status).toBe(400);
    const ok = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF");
    expect((await upload(editor, ok, "edital.pdf", "application/pdf")).status).toBe(201);
  });

  it("private files are not served publicly", async () => {
    const editor = await login("m5", "EDITOR");
    const res = await upload(editor, await pngWithMetadata(), "privada.png", "image/png", "false");
    expect(res.status).toBe(201);
    expect((await request(app).get(`/api/v1/public/media/${res.body.id}`)).status).toBe(404);
    expect((await editor.get(`/api/v1/admin/media/${res.body.id}/file`)).status).toBe(200);
  });

  it("editors cannot delete files", async () => {
    const editor = await login("m6", "EDITOR");
    const res = await upload(editor, await pngWithMetadata(), "a.png", "image/png");
    expect((await editor.del(`/api/v1/admin/media/${res.body.id}`)).status).toBe(403);
  });
});

describe("administrator management", () => {
  beforeEach(clearFirestore);

  it("nobody can change their own role", async () => {
    const sa = await login("sa1", "SUPER_ADMIN");
    const res = await sa.patch(`/api/v1/admin/users/${sa.uid}/role`, { role: "EDITOR" });
    expect(res.status).toBe(403);
  });

  it("publishers cannot escalate privileges", async () => {
    const pub = await login("pb-esc", "PUBLISHER");
    expect((await pub.patch(`/api/v1/admin/users/${pub.uid}/role`, { role: "SUPER_ADMIN" })).status).toBe(403);
    expect((await pub.post("/api/v1/admin/users", { email: "x@example.test", name: "X", role: "SUPER_ADMIN" })).status).toBe(403);
  });

  it("role changes revoke the target's sessions and are audited", async () => {
    const sa = await login("sa2", "SUPER_ADMIN");
    const target = await login("tg1", "EDITOR");
    expect((await sa.patch(`/api/v1/admin/users/${target.uid}/role`, { role: "PUBLISHER" })).status).toBe(200);
    expect((await target.get("/api/v1/admin/dashboard")).status).toBe(401);
    const audit = await db.collection(COLLECTIONS.auditLogs).where("action", "==", "user.role_change").get();
    expect(audit.size).toBe(1);
    expect(JSON.stringify(audit.docs[0]!.data())).not.toMatch(/__session|csrf/i);
  });

  it("suspension immediately blocks access", async () => {
    const sa = await login("sa3", "SUPER_ADMIN");
    const target = await login("tg2", "EDITOR");
    expect((await sa.post(`/api/v1/admin/users/${target.uid}/suspend`)).status).toBe(200);
    expect((await target.get("/api/v1/admin/dashboard")).status).toBe(401);
  });

  it("invites create an administrator without a password", async () => {
    const sa = await login("sa4", "SUPER_ADMIN");
    const res = await sa.post("/api/v1/admin/users", { email: "Nova@Example.test", name: "Nova Pessoa", role: "EDITOR" });
    expect(res.status).toBe(201);
    const doc = await db.collection(COLLECTIONS.adminUsers).doc(res.body.uid).get();
    expect(doc.data()!.email).toBe("nova@example.test");
    expect((await sa.post("/api/v1/admin/users", { email: "nova@example.test", name: "Nova", role: "EDITOR" })).status).toBe(409);
  });
});
