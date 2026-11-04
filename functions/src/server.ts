/**
 * Local development server: `npm run dev` (uses the Firebase emulators via env vars).
 * In production the same Express app is served by Vercel Functions (api/index.js).
 */
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 8787);
createApp().listen(port, () => {
  console.log(`LATox API em http://localhost:${port}/api/v1/health`);
});
