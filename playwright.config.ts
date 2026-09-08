import { defineConfig } from "@playwright/test";

/**
 * Dev-flow e2e suite.
 *
 * Runs against a dedicated dev server on :3001 with the API base overridden to
 * the test mock (e2e/mock-backend.mjs on :8000), so tests never touch the real
 * deployed backend and stay hermetic/repeatable. The app itself contains no
 * stub — the mock lives only under e2e/ and is used solely by tests.
 */
export default defineConfig({
  testDir: "e2e",
  // PWA/offline checks need the production build (SW registers in prod only);
  // they run via playwright.pwa.config.ts.
  testIgnore: ["e2e/pwa.spec.ts"],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- -p 3001",
      url: "http://localhost:3001",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
