import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, clearFirestore, login, mockToken, ORIGIN, randomIp, seedAdmin } from "./helpers";

const session = (ip = randomIp()) =>
  request(app).post("/api/v1/auth/session").set("Origin", ORIGIN).set("X-Forwarded-For", ip).send({ idToken: "x".repeat(40) });

describe("authentication & sessions", () => {
  beforeEach(clearFirestore);

  it("blocks the admin API without a session", async () => {
    const res = await request(app).get("/api/v1/admin/dashboard");
    expect(res.status).toBe(401);
  });

  it("rejects a forged/unknown session cookie", async () => {
    const res = await request(app).get("/api/v1/admin/dashboard").set("Cookie", `__session=${"a".repeat(43)}`);
    expect(res.status).toBe(401);
  });

  it("requires a second factor (MFA) to create a session", async () => {
    await seedAdmin("u-mfa", "SUPER_ADMIN");
    mockToken("u-mfa", { mfa: false });
    const res = await session();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MFA_REQUIRED");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects stale authentications (auth_time too old)", async () => {
    await seedAdmin("u-old", "SUPER_ADMIN");
    mockToken("u-old", { authAgeSeconds: 3600 });
    expect((await session()).status).toBe(401);
  });

  it("returns a generic error for identities that are not administrators", async () => {
    mockToken("random-user");
    const res = await session();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("LOGIN_FAILED");
  });

  it("denies suspended administrators with the same generic error", async () => {
    await seedAdmin("u-susp", "SUPER_ADMIN", "suspended");
    mockToken("u-susp");
    const res = await session();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("LOGIN_FAILED");
  });

  it("rejects login from an untrusted origin (login CSRF)", async () => {
    await seedAdmin("u-orig", "SUPER_ADMIN");
    mockToken("u-orig");
    const res = await request(app)
      .post("/api/v1/auth/session")
      .set("Origin", "https://evil.example")
      .send({ idToken: "x".repeat(40) });
    expect(res.status).toBe(403);
  });

  it("issues an HttpOnly, SameSite=Strict session cookie and never returns the token in JSON", async () => {
    await seedAdmin("u-ok", "EDITOR");
    mockToken("u-ok");
    const res = await session();
    expect(res.status).toBe(201);
    const cookie = String(res.headers["set-cookie"]?.[0]);
    expect(cookie).toMatch(/^__session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const sessionValue = cookie.split(";")[0]!.split("=")[1]!;
    expect(JSON.stringify(res.body)).not.toContain(sessionValue);
  });

  it("rotates the session identifier on every login", async () => {
    const a = await login("u-rot", "EDITOR");
    const b = await login("u-rot", "EDITOR");
    expect(a.cookie).not.toBe(b.cookie);
  });

  it("enforces CSRF tokens on state-changing admin requests", async () => {
    const agent = await login("u-csrf", "EDITOR");
    const noToken = await request(app)
      .post("/api/v1/admin/news")
      .set("Cookie", agent.cookie)
      .set("Origin", ORIGIN)
      .send({ title: "x".repeat(5), summary: "", contentHtml: "", category: "" });
    expect(noToken.status).toBe(403);
    const wrongToken = await request(app)
      .post("/api/v1/admin/news")
      .set("Cookie", agent.cookie)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", "wrong")
      .send({});
    expect(wrongToken.status).toBe(403);
    const badOrigin = await request(app)
      .post("/api/v1/admin/news")
      .set("Cookie", agent.cookie)
      .set("Origin", "https://evil.example")
      .set("X-CSRF-Token", agent.csrf)
      .send({});
    expect(badOrigin.status).toBe(403);
  });

  it("rejects form-encoded bodies (classic CSRF vector)", async () => {
    const agent = await login("u-form", "EDITOR");
    const res = await request(app)
      .post("/api/v1/admin/news")
      .set("Cookie", agent.cookie)
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", agent.csrf)
      .type("form")
      .send("title=hello");
    expect(res.status).toBe(415);
  });

  it("invalidates the session on logout", async () => {
    const agent = await login("u-out", "EDITOR");
    expect((await agent.post("/api/v1/auth/logout")).status).toBe(204);
    expect((await agent.get("/api/v1/admin/dashboard")).status).toBe(401);
  });

  it("rate-limits repeated login attempts", async () => {
    mockToken("nobody");
    const ip = randomIp();
    const statuses: number[] = [];
    for (let i = 0; i < 24; i++) statuses.push((await session(ip)).status);
    expect(statuses).toContain(429);
  });

  it("does not leak stack traces and sends security headers", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts/);
  });

  it("never reflects arbitrary origins in CORS", async () => {
    const res = await request(app).options("/api/v1/public/settings").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
