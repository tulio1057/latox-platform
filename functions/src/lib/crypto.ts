import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const hashIp = (ip: string | undefined) => sha256(`${config.ipHashSalt}:${ip ?? "unknown"}`).slice(0, 32);

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
