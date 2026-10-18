import { chromium, devices } from "@playwright/test";
const out = process.argv[2];
const urls = process.argv.slice(3);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
for (const [i, u] of urls.entries()) {
  for (const [name, ctxOpts] of [["desktop", { viewport: { width: 1380, height: 900 } }], ["phone", { ...devices["iPhone 14"] }]]) {
    const ctx = await browser.newContext({ ...ctxOpts, locale: "he-IL" });
    const page = await ctx.newPage();
    await page.goto(u, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/shot-${i}-${name}.png`, fullPage: name === "desktop" });
    await ctx.close();
  }
}
await browser.close();
