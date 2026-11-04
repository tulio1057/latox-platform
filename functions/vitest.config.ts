import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      GCLOUD_PROJECT: "demo-latox",
      STORAGE_BUCKET: "demo-latox.appspot.com",
      ALLOWED_ORIGINS: "http://localhost:3000",
    },
  },
});
