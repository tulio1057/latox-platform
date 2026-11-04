import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { config } from "../config";
import { safeEqual } from "../lib/crypto";
import { HttpError } from "../lib/errors";
import { COLLECTIONS, db } from "../lib/firebase";
import { logger } from "../lib/log";

/**
 * Housekeeping called once a day by Vercel Cron (the free Spark plan has no Firestore
 * TTL policies). Vercel sends "Authorization: Bearer <CRON_SECRET>".
 */
export function internalRouter(): Router {
  const r = Router();
  r.get("/cleanup", async (req, res) => {
    const auth = req.get("authorization") ?? "";
    if (!config.cronSecret || !safeEqual(auth, `Bearer ${config.cronSecret}`)) {
      throw new HttpError(401, "UNAUTHENTICATED", "Não autorizado.");
    }
    const now = Timestamp.now();
    const purge = async (collection: string, field: string) => {
      let total = 0;
      for (;;) {
        const snap = await db.collection(collection).where(field, "<", now).limit(400).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        total += snap.size;
      }
      return total;
    };
    const result = {
      sessions: await purge(COLLECTIONS.adminSessions, "expiresAt"),
      challenges: await purge(COLLECTIONS.mfaChallenges, "expiresAt"),
      rateLimits: await purge(COLLECTIONS.rateLimits, "expireAt"),
    };
    logger.info("cleanup", result);
    res.json({ ok: true, ...result });
  });
  return r;
}
