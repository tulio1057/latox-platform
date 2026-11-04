import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, clearFirestore, login, mfaStep, mockToken, ORIGIN, passwordStep, randomIp, seedAdmin } from "./helpers";
import { currentCode } from "../src/auth/totp";
import { COLLECTIONS, db } from "../src/lib/firebase";

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

  it("never creates a session from the password alone (MFA is mandatory)", async () => {
    await seedAdmin("u-mfa", "SUPER_ADMIN");
    mockToken("u-mfa");
    const res = await session();
    expect(res.status).toBe(200);
    expect(res.body.mfa).toBe("enroll");
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect((await request(app).get("/api/v1/admin/dashboard")).status).toBe(401);
  });

  it("stores the TOTP secret encrypted and issues one-time recovery codes", async () => {
    const agent = await login("u-enc", "EDITOR");
    expect(agent.recoveryCodes).toHaveLength(8);
    const doc = (await db.collection(COLLECTIONS.adminUsers).doc("u-enc").get()).data()!;
    expect(String(doc.totpSecretEnc)).toMatch(/^v1:/);
    expect(JSON.stringify(doc)).not.toContain(agent.secret);
    expect(JSON.stringify(doc)).not.toContain(agent.recoveryCodes[0]);
  });

  it("rejects wrong codes and locks the challenge after 5 attempts", async () => {
    await login("u-brute", "EDITOR");
    mockToken("u-brute");
    const ip = randomIp();
    const step1 = await passwordStep(ip);
    expect(step1.body.mfa).toBe("verify");
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await mfaStep(ip, { challenge: step1.body.challenge, code: "000000" })).status);
    expect(statuses.every((s) => s === 401)).toBe(true);
    expect((await db.collection(COLLECTIONS.mfaChallenges).get()).size).toBe(0);
  });

  it("rejects replayed TOTP codes", async () => {
    const agent = await login("u-replay", "EDITOR");
    mockToken("u-replay");
    const ip = randomIp();
    // The enrolment already consumed the current time step.
    const a = await passwordStep(ip);
    expect((await mfaStep(ip, { challenge: a.body.challenge, code: currentCode(agent.secret) })).status).toBe(401);
    const b = await passwordStep(ip);
    expect((await mfaStep(ip, { challenge: b.body.challenge, code: currentCode(agent.secret, 1) })).status).toBe(201);
  });

  it("accepts a recovery code exactly once", async () => {
    const agent = await login("u-rc", "EDITOR");
    mockToken("u-rc");
    const ip = randomIp();
    const a = await passwordStep(ip);
    expect((await mfaStep(ip, { challenge: a.body.challenge, recoveryCode: agent.recoveryCodes[0] })).status).toBe(201);
    const b = await passwordStep(ip);
    expect((await mfaStep(ip, { challenge: b.body.challenge, recoveryCode: agent.recoveryCodes[0] })).status).toBe(401);
  });

  it("re-authentication must be completed by the session that requested it", async () => {
    const owner = await login("u-reauth", "SUPER_ADMIN");
    const other = await login("u-other", "SUPER_ADMIN");
    mockToken("u-reauth");
    const ch = await owner.post("/api/v1/auth/reauth", { idToken: "x".repeat(40) });
    expect(ch.status).toBe(200);
    const stolen = await mfaStep(other.ip, { challenge: ch.body.challenge, code: currentCode(owner.secret, 1) }, other.cookie);
    expect(stolen.status).toBe(401);
    const ch2 = await owner.post("/api/v1/auth/reauth", { idToken: "x".repeat(40) });
    const ok = await mfaStep(owner.ip, { challenge: ch2.body.challenge, code: currentCode(owner.secret, 1) }, owner.cookie);
    expect(ok.status).toBe(200);
    expect(ok.body.csrfToken).toBeTruthy();
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
    const step1 = await session();
    const res = await mfaStep(randomIp(), { challenge: step1.body.challenge, code: currentCode(step1.body.secret) });
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
