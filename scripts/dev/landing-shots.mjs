/**
 * Screenshots of the landing page at several scroll positions (phone, tablet,
 * desktop) plus overflow and console checks.
 *
 *   node scripts/dev/landing-shots.mjs <outDir> [baseURL] [--reduce]
 *
 * Uses PW_CHROMIUM_PATH when set; SwiftShader GL so MapLibre renders headless.
 */
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const reduce = process.argv.includes("--reduce");
const out = args[0] ?? "landing-shots";
const base = args[1] ?? "http://localhost:3100";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

const VIEWPORTS = [
  ["phone", { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } }],
  ["tablet", { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, hasTouch: true }],
  ["desktop", { viewport: { width: 1380, height: 900 }, deviceScaleFactor: 1 }],
];
const STOPS = ["top", "#options", "#safety", "#price", "#drive", "#faq", "footer"];

let problems = 0;
for (const [name, opts] of VIEWPORTS) {
  const ctx = await browser.newContext({ ...opts, locale: "he-IL", timezoneId: "Asia/Jerusalem", reducedMotion: reduce ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForSelector(".hop-map canvas", { timeout: 30_000 }).catch(() => errors.push("map canvas never appeared"));
  await page.waitForTimeout(4000);
  for (const stop of STOPS) {
    if (stop === "top") await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    else if (stop === "footer") await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    else await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ behavior: "instant", block: "start" }), stop);
    await page.waitForTimeout(900);
    const file = `${out}/${name}${reduce ? "-reduce" : ""}-${stop.replace("#", "")}.png`;
    await page.screenshot({ path: file });
  }
  // Interactions: another example trip in the price card, and an open FAQ answer.
  const card = page.getByTestId("landing-fare-example");
  await card.scrollIntoViewIfNeeded();
  await card.getByText("ארוכה", { exact: true }).click();
  await page.waitForTimeout(1200);
  await card.screenshot({ path: `${out}/${name}${reduce ? "-reduce" : ""}-price-long.png` });
  const faq = page.locator(".lp-faq-item").first();
  await faq.locator("summary").click();
  await page.waitForTimeout(600);
  await page.locator(".lp-faq").screenshot({ path: `${out}/${name}${reduce ? "-reduce" : ""}-faq-open.png` });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}${reduce ? "-reduce" : ""}-full.png`, fullPage: true });
  const { sw, cw, wide } = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > cw + 1 || r.left < -1) && !el.closest(".hop-map, .lp-hero-map");
      })
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    return { sw: document.documentElement.scrollWidth, cw, wide };
  });
  const overflow = sw > cw + 1;
  if (overflow || errors.length) problems++;
  console.log(`${name}: scrollWidth ${sw} / clientWidth ${cw} ${overflow ? "OVERFLOW" : "ok"}${wide.length ? ` wide: ${wide.join(", ")}` : ""}`);
  if (errors.length) console.log(`  console errors:\n   - ${errors.slice(0, 8).join("\n   - ")}`);
  await ctx.close();
}
await browser.close();
process.exit(problems ? 1 : 0);
