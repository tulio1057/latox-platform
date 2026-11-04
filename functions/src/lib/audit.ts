import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { Request } from "express";
import { COLLECTIONS, db } from "./firebase";
import { hashIp } from "./crypto";

export type AuditResult = "success" | "failure" | "denied";

export interface AuditEntry {
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  result: AuditResult;
  /** Non-sensitive metadata only. Never pass passwords, tokens, cookies or candidate data. */
  meta?: Record<string, string | number | boolean | null>;
  /** Override actor (e.g. during login, before req.admin is set). */
  actor?: { uid: string; email: string | null };
}

const FORBIDDEN_META = /pass|token|cookie|secret|session|csrf|authorization/i;

/**
 * Append-only audit log. Written only by the server (Firestore rules deny all client
 * access, no API route updates or deletes entries) and mirrored to Cloud Logging,
 * which is retained independently of Firestore.
 */
export async function audit(req: Request, entry: AuditEntry): Promise<void> {
  const meta: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(entry.meta ?? {})) {
    if (!FORBIDDEN_META.test(k)) meta[k] = typeof v === "string" ? v.slice(0, 300) : v;
  }
  const actor = entry.actor ?? (req.admin ? { uid: req.admin.uid, email: req.admin.email } : null);
  const record = {
    actorUid: actor?.uid ?? null,
    actorEmail: actor?.email ?? null,
    action: entry.action,
    resourceType: entry.resourceType ?? null,
    resourceId: entry.resourceId ?? null,
    result: entry.result,
    meta,
    ipHash: hashIp(req.clientIp),
    at: FieldValue.serverTimestamp(),
  };
  logger.info("audit", { ...record, at: new Date().toISOString() });
  try {
    await db.collection(COLLECTIONS.auditLogs).add(record);
  } catch (err) {
    logger.error("audit write failed", { action: entry.action, message: (err as Error).message });
  }
}
