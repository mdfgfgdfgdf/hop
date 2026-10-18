// Quick single-page screenshots: node scripts/dev/rider-quick.mjs <path> [name] [actions...]
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = process.env.OUT_DIR || "/tmp/claude-0/-home-user-hop/71bf8acf-8656-5cac-8fb7-200922f65bdb/scratchpad/rider-v2";
const path = process.argv[2] || "/ride";
const name = process.argv[3] || "quick";
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
for (const [label, opts] of [["phone", { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } }], ["desktop", { viewport: { width: 1380, height: 900 } }]]) {
  const state = `${OUT}/.rider-session.json`; // written by rider-shots.mjs (login is rate limited)
  const ctx = await browser.newContext({ ...opts, ...(fs.existsSync(state) ? { storageState: state } : {}), locale: "he-IL", permissions: ["geolocation"], geolocation: { latitude: 32.0752, longitude: 34.7751 } });
  if (!fs.existsSync(state)) {
    const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: "rider@hop.local", password: "Rider1234!" } });
    if (!res.ok()) throw new Error("login failed " + res.status());
  }
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`[${label}] console.${m.type()}:`, m.text().slice(0, 300)); });
  page.on("pageerror", (e) => console.log(`[${label}] pageerror:`, e.message));
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}-${label}.png` });
  await ctx.close();
}
await browser.close();
