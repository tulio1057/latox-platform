"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, inMemoryPersistence, initializeAuth, type Auth } from "firebase/auth";

let auth: Auth | null = null;

/**
 * Firebase Auth is only used to verify password + second factor in the browser and to
 * obtain a short-lived ID token, which is immediately exchanged for an HttpOnly server
 * session. Persistence is in-memory: nothing is written to localStorage/IndexedDB.
 */
export function getClientAuth(): Auth {
  if (auth) return auth;
  const app: FirebaseApp =
    getApps()[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  auth = initializeAuth(app, { persistence: inMemoryPersistence });
  auth.languageCode = "pt";
  if (process.env.NEXT_PUBLIC_USE_AUTH_EMULATOR === "true") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}
