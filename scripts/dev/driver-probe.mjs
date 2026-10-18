// Debug probe: log in, open a page, evaluate a JS expression.  node driver-probe.mjs <email> <path> "<js expr>"
import { chromium, devices } from "@playwright/test";
const [email, path, expr] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3002";
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ ...devices["iPhone 14"], viewport: { width: 390, height: 844 }, locale: "he-IL", geolocation: { latitude: 32.0752, longitude: 34.7751 }, permissions: ["geolocation"] });
const page = await ctx.newPage();
page.on("console", (m) => console.log(`[console.${m.type()}]`, m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.request.post(`${BASE}/api/auth/login`, { data: { email, password: process.env.PASSWORD ?? "Driver1234!" } });
await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(Number(process.env.WAIT ?? 5000));
console.log(JSON.stringify(await page.evaluate(expr), null, 2));
await browser.close();
