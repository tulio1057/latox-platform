import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin initialisation.
 * - Production (Vercel): FIREBASE_SERVICE_ACCOUNT holds the service-account JSON
 *   (raw or base64). It is a secret: set only in the hosting provider's env settings.
 * - Development/tests: emulators (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST)
 *   with project "demo-latox", no credentials needed.
 */
function serviceAccountFromEnv(): { project_id?: string } | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return undefined;
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

function init(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const sa = serviceAccountFromEnv();
  if (sa) {
    return initializeApp({ credential: cert(sa as Parameters<typeof cert>[0]), projectId: sa.project_id });
  }
  // Local tooling may use Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS).
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "demo-latox";
  return initializeApp({ projectId });
}

const app = init();

export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
export const adminAuth = getAuth(app);

export const COLLECTIONS = {
  adminUsers: "adminUsers",
  adminSessions: "adminSessions",
  mfaChallenges: "mfaChallenges",
  news: "news",
  projects: "projects",
  events: "events",
  team: "teamMembers",
  selectionProcesses: "selectionProcesses",
  selectionResults: "selectionResults",
  media: "mediaFiles",
  mediaChunks: "mediaChunks",
  settings: "siteSettings",
  auditLogs: "auditLogs",
  revisions: "contentRevisions",
  rateLimits: "rateLimits",
} as const;
