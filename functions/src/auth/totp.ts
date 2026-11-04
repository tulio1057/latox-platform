import { createCipheriv, createDecipheriv, randomBytes, randomInt } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { config } from "../config";
import { sha256 } from "../lib/crypto";

/**
 * TOTP (RFC 6238) second factor verified by the API, using the maintained `otpauth`
 * library. Secrets are encrypted at rest with AES-256-GCM (Node crypto). No custom
 * cryptography: only standard primitives and library calls.
 */
const PERIOD = 30;

function key(): Buffer {
  const hex = config.mfa.encryptionKeyHex;
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("TOTP_ENC_KEY ausente ou inválida (64 caracteres hexadecimais).");
  return Buffer.from(hex, "hex");
}

export function encryptSecret(base32: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(base32, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(blob: string): string {
  const [v, iv, tag, ct] = blob.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("formato de segredo inválido");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

export function newSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totp(base32: string, label = "admin") {
  return new TOTP({ issuer: config.mfa.issuer, label, algorithm: "SHA1", digits: 6, period: PERIOD, secret: Secret.fromBase32(base32) });
}

export function otpauthUrl(base32: string, label: string): string {
  return totp(base32, label).toString();
}

/**
 * Validates a 6-digit code (±1 time step for clock drift). Returns the matched time
 * step, or null. Codes whose step is not newer than `lastStep` are rejected (no replay).
 */
export function verifyCode(base32: string, code: string, lastStep: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = totp(base32).validate({ token: code, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / PERIOD) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}

/** Code for the current (or an adjacent) time step. Used by tests and tooling. */
export function currentCode(base32: string, offsetSteps = 0): string {
  return totp(base32).generate({ timestamp: Date.now() + offsetSteps * PERIOD * 1000 });
}

const RC_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newRecoveryCodes(n = config.mfa.recoveryCodes): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: n }, () => {
    const s = Array.from({ length: 10 }, () => RC_ALPHABET[randomInt(RC_ALPHABET.length)]).join("");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashRecoveryCode) };
}

export function hashRecoveryCode(code: string): string {
  return sha256(`latox-rc:${code.trim().toUpperCase()}`);
}
