import { defineConfig } from "@playwright/test";

/**
 * Browser-agnostic e2e setup for MediDrone.
 * Browsers are launched through e2e/fixtures.ts (which locates a Chromium
 * binary + shared libs in the sandbox); only the web server config lives here.
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
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
