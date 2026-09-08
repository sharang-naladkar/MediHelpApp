import { defineConfig } from "@playwright/test";

/**
 * PWA-focused config: runs against the production build (npm start) because
 * the service worker only registers when NODE_ENV === "production".
 *
 *   npx playwright test --config=playwright.pwa.config.ts
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: /pwa\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 240_000,
    env: { NEXT_DIST_DIR: ".next-pwa" },
  },
});
