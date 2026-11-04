import type { Request, RequestHandler } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS, db } from "./firebase";
import { hashIp, sha256 } from "./crypto";
import { HttpError } from "./errors";

/**
 * Fast per-instance limiter (cheap first line of defence). Cloud Functions may run many
 * instances, so sensitive endpoints additionally use the shared Firestore limiter below.
 */
export function memoryRateLimit(opts: { windowMs: number; max: number; key?: (req: Request) => string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    const key = opts.key ? opts.key(req) : hashIp(req.clientIp);
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return next(new HttpError(429, "RATE_LIMITED", "Muitas requisições. Tente novamente mais tarde."));
    }
    next();
  };
}

/** Shared limiter backed by Firestore (transactional counter, fixed window). */
export async function consumeSharedLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const ref = db.collection(COLLECTIONS.rateLimits).doc(sha256(key));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.data() as { count: number; windowStart: number } | undefined;
    if (!data || now - data.windowStart > windowMs) {
      tx.set(ref, { count: 1, windowStart: now, expireAt: Timestamp.fromMillis(now + windowMs * 2) });
      return true;
    }
    if (data.count >= max) return false;
    tx.update(ref, { count: data.count + 1 });
    return true;
  });
}

export function sharedRateLimit(name: string, max: number, windowMs: number): RequestHandler {
  return async (req, _res, next) => {
    const ok = await consumeSharedLimit(`${name}:${hashIp(req.clientIp)}`, max, windowMs);
    if (!ok) return next(new HttpError(429, "RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos."));
    next();
  };
}
