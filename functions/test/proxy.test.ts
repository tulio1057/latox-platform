import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { config } from "../src/config";
import { app, clearFirestore } from "./helpers";

const SECRET = "s".repeat(48);

describe("website proxy front door (API_PROXY_SECRET)", () => {
  beforeEach(async () => {
    await clearFirestore();
    config.proxySecret = SECRET;
  });
  afterEach(() => {
    config.proxySecret = "";
  });

  it("rejects direct calls that bypass the website proxy", async () => {
    const res = await request(app).get("/api/v1/public/settings");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("DIRECT_ACCESS_DENIED");
    expect((await request(app).get("/api/v1/public/settings").set("x-latox-proxy", "wrong")).status).toBe(403);
  });

  it("keeps the health check reachable for uptime monitoring", async () => {
    expect((await request(app).get("/api/v1/health")).status).toBe(200);
  });

  it("accepts proxied calls and rate-limits by the visitor IP, not the proxy IP", async () => {
    const proxied = (ip: string) =>
      request(app).post("/api/v1/auth/session").set("x-latox-proxy", SECRET).set("x-real-ip", ip).set("Origin", "http://localhost:3000").send({ idToken: "x".repeat(40) });
    const statuses: number[] = [];
    for (let i = 0; i < 24; i++) statuses.push((await proxied("203.0.113.7")).status);
    expect(statuses).toContain(429);
    // A different visitor behind the same proxy is not affected.
    expect((await proxied("198.51.100.9")).status).not.toBe(429);
  });

  it("lets authenticated SSR reads skip per-IP limits", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 320; i++) {
      statuses.push((await request(app).get("/api/v1/health").set("x-latox-proxy", SECRET).set("x-latox-ssr", "1").set("x-real-ip", "10.9.9.9")).status);
    }
    expect(statuses).toContain(429); // health is not a public read: SSR bypass does not apply
    const ssr = await request(app).get("/api/v1/public/team").set("x-latox-proxy", SECRET).set("x-latox-ssr", "1").set("x-real-ip", "10.9.9.9");
    expect(ssr.status).toBe(200);
  });
});
