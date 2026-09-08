import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

export const TEST_PROFILE = {
  name: "Ananya Sharma",
  phone: "+91 98765 43210",
  phoneNormalized: "919876543210",
  aadhaar_last4: "1234",
};

export async function setupProfile(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /one-time setup/i })).toBeVisible();
  await page.getByLabel("Full name").fill(TEST_PROFILE.name);
  await page.getByLabel("Phone number").fill(TEST_PROFILE.phone);
  await page.getByLabel("Aadhaar last 4 digits").fill(TEST_PROFILE.aadhaar_last4);
  await page.getByRole("button", { name: /save & continue/i }).click();
  await page.waitForURL("**/home");
}

/** Reads the mock backend's recorded requests (test-only control endpoint). */
export async function mockRequests(): Promise<
  Array<{ method: string; path: string; body: unknown | null; status: number; at: number }>
> {
  const res = await fetch("http://localhost:8000/__test/requests");
  if (!res.ok) throw new Error(`mock /__test/requests -> ${res.status}`);
  return (await res.json()) as Array<{
    method: string;
    path: string;
    body: unknown | null;
    status: number;
    at: number;
  }>;
}

export async function setMockMode(mode: string) {
  const res = await fetch("http://localhost:8000/__test/mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`mock /__test/mode -> ${res.status}`);
}

export async function resetMock() {
  await fetch("http://localhost:8000/__test/reset", { method: "POST" });
}
