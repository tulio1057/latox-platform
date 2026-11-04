import { vi } from "vitest";
import request from "supertest";
import { Timestamp } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createApp } from "../src/app";
import { COLLECTIONS, db } from "../src/lib/firebase";
import { verifyIdToken } from "../src/lib/identity";

export const ORIGIN = "http://localhost:3000";
export const app = createApp();

let counter = 0;
export const randomIp = () => `10.${(counter >> 8) & 255}.${counter++ & 255}.${Math.floor(Math.random() * 250) + 1}`;

export interface TokenOptions {
  mfa?: boolean;
  authAgeSeconds?: number;
  email?: string;
}

export function mockToken(uid: string, opts: TokenOptions = {}) {
  const decoded = {
    uid,
    email: opts.email ?? `${uid}@example.test`,
    auth_time: Math.floor(Date.now() / 1000) - (opts.authAgeSeconds ?? 5),
    firebase: { sign_in_provider: "password", ...(opts.mfa === false ? {} : { sign_in_second_factor: "totp" }) },
  } as unknown as DecodedIdToken;
  vi.mocked(verifyIdToken).mockResolvedValue(decoded);
}

export async function seedAdmin(uid: string, role: string, status = "active") {
  await db.collection(COLLECTIONS.adminUsers).doc(uid).set({
    email: `${uid}@example.test`,
    name: uid,
    role,
    status,
    createdAt: Timestamp.now(),
  });
}

export interface Agent {
  uid: string;
  cookie: string;
  csrf: string;
  ip: string;
  get(path: string): request.Test;
  post(path: string, body?: unknown): request.Test;
  patch(path: string, body?: unknown): request.Test;
  put(path: string, body?: unknown): request.Test;
  del(path: string): request.Test;
}

/** Logs in through the real /auth/session endpoint (with a mocked ID token). */
export async function login(uid: string, role: string): Promise<Agent> {
  await seedAdmin(uid, role);
  mockToken(uid);
  const ip = randomIp();
  const res = await request(app)
    .post("/api/v1/auth/session")
    .set("Origin", ORIGIN)
    .set("X-Forwarded-For", ip)
    .send({ idToken: "x".repeat(40) });
  if (res.status !== 201) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = String(res.headers["set-cookie"]?.[0] ?? "").split(";")[0]!;
  const csrf = res.body.csrfToken as string;
  const withAuth = (t: request.Test) => t.set("Cookie", cookie).set("Origin", ORIGIN).set("X-CSRF-Token", csrf).set("X-Forwarded-For", ip);
  return {
    uid,
    cookie,
    csrf,
    ip,
    get: (p) => withAuth(request(app).get(p)),
    post: (p, b = {}) => withAuth(request(app).post(p)).send(b as object),
    patch: (p, b = {}) => withAuth(request(app).patch(p)).send(b as object),
    put: (p, b = {}) => withAuth(request(app).put(p)).send(b as object),
    del: (p) => withAuth(request(app).delete(p)),
  };
}

export async function clearFirestore() {
  const project = process.env.GCLOUD_PROJECT ?? "demo-latox";
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error("Firestore emulator not running (FIRESTORE_EMULATOR_HOST unset)");
  await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: "DELETE" });
}

export const NEWS = {
  title: "Notícia de teste",
  summary: "Resumo",
  contentHtml: "<p>Conteúdo</p>",
  category: "Geral",
};
