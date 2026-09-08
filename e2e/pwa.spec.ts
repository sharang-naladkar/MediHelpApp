import { test, expect } from "./fixtures";
import { resetMock } from "./helpers";

test("PWA: valid manifest + icons, service worker installs, shell cached", async ({ mdContext }) => {
  const page = await mdContext.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /one-time setup/i })).toBeVisible();

  const manifestRes = await page.request.get("/manifest.webmanifest");
  expect(manifestRes.ok()).toBeTruthy();
  const manifest = (await manifestRes.json()) as {
    display: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string; purpose: string }>;
  };
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of manifest.icons) {
    const iconRes = await page.request.get(icon.src);
    expect(iconRes.ok()).toBeTruthy();
    expect(iconRes.headers()["content-type"]).toContain("image/png");
  }

  // Service worker registers and claims the page (production only)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 10_000,
    })
    .toBe(true);

  // Shell (navigation + static assets) is cached; API origin is NOT cached
  const cachedUrls = await page.evaluate(async () => {
    const cache = await caches.open("medidrone-shell-v1");
    return (await cache.keys()).map((k) => k.url);
  });
  expect(cachedUrls.some((u) => u.endsWith("/"))).toBe(true);
  expect(cachedUrls.some((u) => u.includes("manifest.webmanifest"))).toBe(true);
  expect(cachedUrls.some((u) => u.includes("8000"))).toBe(false);
});

test("offline: shell still loads from cache; SOS failure is visible (no fake data)", async ({ mdContext }) => {
  await resetMock();
  await mdContext.grantPermissions(["geolocation"]);
  await mdContext.setGeolocation({ latitude: 28.6139, longitude: 77.209, accuracy: 12 });
  const page = await mdContext.newPage();

  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // ensure the SW controls this client before offline

  // Create the profile and visit /home while still online so its route chunk
  // is cached; then go offline and prove the cached shell still works.
  await page.getByLabel("Full name").fill("Offline Tester");
  await page.getByLabel("Phone number").fill("+91 98765 43211");
  await page.getByLabel("Aadhaar last 4 digits").fill("4321");
  await page.getByRole("button", { name: /save & continue/i }).click();
  await page.waitForURL("**/home");
  await page.reload();

  await mdContext.setOffline(true);
  await page.goto("/home");
  await expect(page.getByTestId("sos-button")).toBeVisible();

  // A SOS attempt offline must fail visibly (auto-retries, then error card)
  await page.getByTestId("sos-button").click();
  await expect(page.locator('main [role="alert"]')).toContainText(/could not reach|network/i, {
    timeout: 30_000,
  });
  // And no API request ever reached the network — the SW never fabricates one.
  const apiHits = async () => {
    const res = await page.request.get("http://localhost:8000/__test/requests");
    return res.ok() ? ((await res.json()) as Array<{ path: string }>).filter((r) => r.path.startsWith("/api/v1/")).length : -1;
  };
  expect(await apiHits()).toBe(0);
  await page.waitForTimeout(8_000);
  expect(await apiHits()).toBe(0);
  await mdContext.setOffline(false);
});
