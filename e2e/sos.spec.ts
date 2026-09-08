import { test, expect } from "./fixtures";
import {
  mockRequests,
  resetMock,
  setMockMode,
  setupProfile,
} from "./helpers";

const FIX = { latitude: 28.6139, longitude: 77.209, accuracy: 12 };

test.beforeEach(async () => {
  await resetMock();
  await setMockMode("fast");
});

test("SOS: real geolocation → POST with real coords → status screen → terminal stop", async ({ mdContext }) => {
  await mdContext.grantPermissions(["geolocation"]);
  await mdContext.setGeolocation(FIX);
  const page = await mdContext.newPage();
  await setupProfile(page);

  // One tap — no dialogs between press and API call
  await page.getByTestId("sos-button").click();

  await page.waitForURL(/\/emergency\/mock-em-1\?/);
  await expect(page.getByTestId("emergency-id")).toHaveText(/mock-em-1/);

  // Real transition: first poll is RECEIVED, a later poll reaches a terminal
  // state (in dev, React StrictMode may fire the first poll twice — the state
  // sequence moves one step per server-side poll; production is a single poll).
  await expect(page.getByTestId("current-status")).toHaveText("COMPLETED", { timeout: 16_000 });

  // Real coordinates (not 0,0) + profile fields in the POST body
  const posts = (await mockRequests()).filter(
    (r) => r.method === "POST" && r.path === "/api/v1/emergencies"
  );
  expect(posts).toHaveLength(1);
  const body = posts[0].body as Record<string, unknown>;
  expect(body.lat).toBeCloseTo(FIX.latitude, 6);
  expect(body.lng).toBeCloseTo(FIX.longitude, 6);
  expect(body.accuracy).toBeCloseTo(FIX.accuracy, 6);
  expect(typeof body.timestamp).toBe("string");
  expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
  expect(body.name).toBe("Ananya Sharma");
  expect(body.phone).toBe("919876543210");
  expect(body.aadhaar_last4).toBe("1234");

  // Terminal state stops polling: no further GET after COMPLETED
  const isGet = (r: { method: string; path: string }) =>
    r.method === "GET" && r.path.includes("/api/v1/emergencies/mock-em-1");
  const getsAtTerminal = (await mockRequests()).filter(isGet).length;
  expect(getsAtTerminal).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(6_000);
  const getsLater = (await mockRequests()).filter(isGet).length;
  expect(getsLater).toBe(getsAtTerminal);
});

test("geolocation denied: visible error + retry + call-emergency fallback, no API call", async ({ mdContext }) => {
  await mdContext.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(_success: unknown, error: (e: { code: number; message: string }) => void) {
          error({ code: 1, message: "User denied Geolocation" });
        },
      },
    });
  });
  const page = await mdContext.newPage();
  await setupProfile(page);
  await page.getByTestId("sos-button").click();

  await expect(page.locator("main [role=\"alert\"]")).toContainText(/permission was denied/i);
  await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /call emergency services/i })).toHaveAttribute("href", "tel:112");
  const posts = (await mockRequests()).filter(
    (r) => r.method === "POST" && r.path === "/api/v1/emergencies"
  );
  expect(posts).toHaveLength(0);
});

test("geolocation timeout: visible timeout error (never a silent hang)", async ({ mdContext }) => {
  test.setTimeout(40_000);
  await mdContext.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition() {
          /* never call back → app timeout must surface */
        },
      },
    });
  });
  const page = await mdContext.newPage();
  await setupProfile(page);
  await page.getByTestId("sos-button").click();

  await expect(page.locator("main [role=\"alert\"]")).toContainText(/timed out/i, { timeout: 25_000 });
  await expect(page.getByRole("link", { name: /call emergency services/i })).toBeVisible();
});

test("network failure on POST is visible with retry + fallback, no silent hang", async ({ mdContext }) => {
  await setMockMode("fail-post-503");
  await mdContext.grantPermissions(["geolocation"]);
  await mdContext.setGeolocation(FIX);
  const page = await mdContext.newPage();
  await setupProfile(page);
  await page.getByTestId("sos-button").click();

  await expect(page.locator("main [role=\"alert\"]")).toContainText(/HTTP 503/i, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /call emergency services/i })).toHaveAttribute("href", "tel:112");
  // No status redirect happened
  expect(page.url()).not.toContain("/emergency/");
});

test("status poll failures are visible and keep retrying with backoff", async ({ mdContext }) => {
  await setMockMode("fail-poll-500");
  await mdContext.grantPermissions(["geolocation"]);
  await mdContext.setGeolocation(FIX);
  const page = await mdContext.newPage();
  await setupProfile(page);
  await page.getByTestId("sos-button").click();
  await page.waitForURL(/\/emergency\/mock-em-1\?/);

  await expect(page.locator("main [role=\"alert\"]")).toContainText(/status update interrupted/i, { timeout: 20_000 });
  // still auto-retrying: at least 2 GETs observed within ~15 s (backoff 5 s → 10 s)
  await page.waitForTimeout(12_000);
  const gets = (await mockRequests()).filter(
    (r) => r.method === "GET" && r.path.includes("/api/v1/emergencies/mock-em-1")
  );
  expect(gets.length).toBeGreaterThanOrEqual(2);
});
