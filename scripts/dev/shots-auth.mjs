/**
 * Screenshots pages as a logged-in user.
 * usage: PW_CHROMIUM_PATH=... node scripts/dev/shots-auth.mjs <base> <email> <password> <outdir> <width>x<height> <path...>
 */
import { chromium } from "@playwright/test";
const [base, email, password, out, size, ...paths] = process.argv.slice(2);
const [w, h] = size.split("x").map(Number);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: "he-IL", geolocation: { latitude: 32.0752, longitude: 34.7751 }, permissions: ["geolocation"] });
const login = await ctx.request.post(`${base}/api/auth/login`, { data: { email, password } });
if (!login.ok()) throw new Error(`login failed ${login.status()}`);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/tiles|openfreemap|net::ERR/.test(m.text())) errors.push(m.text().slice(0, 200)); });
for (const p of paths) {
  await page.goto(`${base}${p}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForFunction(() => Object.keys(document).some((k) => k.startsWith("__reactContainer")), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const name = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: false });
  console.log("shot", p);
}
console.log("console errors:", errors.slice(0, 8));
await browser.close();
