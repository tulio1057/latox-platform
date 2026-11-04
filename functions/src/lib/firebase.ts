import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const app =
  getApps()[0] ??
  initializeApp(
    process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
      ? undefined
      : { projectId: "demo-latox", storageBucket: "demo-latox.appspot.com" },
  );

export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
export const adminAuth = getAuth(app);

export function bucket() {
  const name = process.env.STORAGE_BUCKET;
  return name ? getStorage(app).bucket(name) : getStorage(app).bucket();
}

export const COLLECTIONS = {
  adminUsers: "adminUsers",
  adminSessions: "adminSessions",
  news: "news",
  projects: "projects",
  events: "events",
  team: "teamMembers",
  selectionProcesses: "selectionProcesses",
  selectionResults: "selectionResults",
  media: "mediaFiles",
  settings: "siteSettings",
  auditLogs: "auditLogs",
  revisions: "contentRevisions",
  rateLimits: "rateLimits",
} as const;
