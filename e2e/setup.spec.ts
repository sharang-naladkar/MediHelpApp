import { test, expect } from "./fixtures";
import { TEST_PROFILE, setupProfile } from "./helpers";

test("first launch shows setup; profile saved to localStorage; future launches skip setup", async ({ mdContext }) => {
  const page = await mdContext.newPage();

  // First launch — no profile
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /one-time setup/i })).toBeVisible();
  await expect(page.getByText(/for identification only/i)).toBeVisible();

  await setupProfile(page);

  // Profile persisted client-side only
  const stored = await page.evaluate(() => localStorage.getItem("medidrone.user-profile.v1"));
  expect(stored).toBeTruthy();
  const parsed = JSON.parse(stored as string) as Record<string, string>;
  expect(parsed.name).toBe(TEST_PROFILE.name);
  expect(parsed.phone).toBe(TEST_PROFILE.phoneNormalized);
  expect(parsed.aadhaar_last4).toBe(TEST_PROFILE.aadhaar_last4);

  // Future launches skip straight to Home
  await page.reload();
  await page.waitForURL("**/home");
  await expect(page.getByTestId("sos-button")).toBeVisible();
  await expect(page.getByRole("heading", { name: /one-time setup/i })).toHaveCount(0);
});

test("setup validation: bad phone and short aadhaar are rejected visibly", async ({ mdContext }) => {
  const page = await mdContext.newPage();
  await page.goto("/");
  await page.getByLabel("Full name").fill("A");
  await page.getByLabel("Phone number").fill("123");
  await page.getByLabel("Aadhaar last 4 digits").fill("12");
  await page.getByRole("button", { name: /save & continue/i }).click();

  await expect(page.getByRole("alert").filter({ hasText: /full name/i })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /valid phone/i })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /last 4 digits only/i })).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("protected home redirects to setup when no profile exists", async ({ mdContext }) => {
  const page = await mdContext.newPage();
  await page.goto("/home");
  await page.waitForURL("**/");
  await expect(page.getByRole("heading", { name: /one-time setup/i })).toBeVisible();
});

test("edit profile is prefilled and saves changes", async ({ mdContext }) => {
  const page = await mdContext.newPage();
  await setupProfile(page);
  await page.getByRole("button", { name: /edit profile/i }).click();
  await page.waitForURL("**/setup");
  await expect(page.getByRole("heading", { name: /edit profile/i })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue(TEST_PROFILE.name);
  await page.getByLabel("Full name").fill("Renamed User");
  await page.getByRole("button", { name: /save changes/i }).click();
  await page.waitForURL("**/home");
  const stored = await page.evaluate(() => localStorage.getItem("medidrone.user-profile.v1"));
  expect(JSON.parse(stored as string).name).toBe("Renamed User");
});
