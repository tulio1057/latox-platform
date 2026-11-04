import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { createApp } from "./app";
import { config } from "./config";

setGlobalOptions({ region: config.region, maxInstances: 10 });

/**
 * Single HTTPS function serving the REST API. Firebase Hosting rewrites /api/** here,
 * so the browser talks to the API on the same origin as the website.
 */
export const api = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 60,
    concurrency: 40,
    invoker: "public",
  },
  createApp(),
);
