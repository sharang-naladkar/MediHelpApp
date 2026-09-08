import { test as base, chromium as playwrightChromium, expect } from "@playwright/test";
import type { Browser, BrowserContext } from "@playwright/test";
import sparticuz from "@sparticuz/chromium";

/**
 * Launches the sandbox's Chromium. The @sparticuz/chromium npm package ships a
 * headless Chromium binary; shared libraries it needs (NSS/NSPR) are provided
 * via MEDIDRONE_BROWSER_LIBS (set by the sandbox tooling). Override that env
 * var if the libs live elsewhere.
 */
export const test = base.extend<{
  mdBrowser: Browser;
  mdContext: BrowserContext;
}>({
  mdBrowser: async ({}, use) => {
    const executablePath = await sparticuz.executablePath();
    const browser = await playwrightChromium.launch({
      executablePath,
      args: sparticuz.args,
      headless: true,
      env: {
        ...process.env,
        LD_LIBRARY_PATH: process.env.MEDIDRONE_BROWSER_LIBS || "/tmp/chrome-libs",
      },
    });
    await use(browser);
    await browser.close();
  },
  mdContext: async ({ mdBrowser }, use) => {
    const context = await mdBrowser.newContext();
    await use(context);
    await context.close();
  },
});

export { expect };
