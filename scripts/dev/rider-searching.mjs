// Captures the "searching" state: loads /ride, orders via the API, screenshots ~1s later.
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = process.env.OUT_DIR || "/tmp/claude-0/-home-user-hop/71bf8acf-8656-5cac-8fb7-200922f65bdb/scratchpad/rider-v2";
const W = Number(process.env.WIDTH || 390);
const H = Number(process.env.HEIGHT || 844);
const STATE = `${OUT}/.rider-session.json`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const device = W >= 1024 ? { viewport: { width: W, height: H } } : { ...devices["iPhone 14"], viewport: { width: W, height: H } };
const ctx = await browser.newContext({ ...device, storageState: fs.existsSync(STATE) ? STATE : undefined, locale: "he-IL", permissions: ["geolocation"], geolocation: { latitude: 32.0567, longitude: 34.77 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/ride`, { waitUntil: "domcontentloaded" });
await page.getByTestId("destination-trigger").waitFor();
const q = await (await ctx.request.post(`${BASE}/api/quotes`, { data: { pickup: { lat: 32.0567, lng: 34.77, address: "פלורנטין" }, dropoff: { lat: 32.0807, lng: 34.7805, address: "אבן גבירול 69", name: "כיכר רבין" } } })).json();
await ctx.request.post(`${BASE}/api/rides`, { data: { quoteId: q.quotes[0].id, paymentMethod: "cash" } });
for (let i = 0; i < Number(process.env.FRAMES || 1); i++) {
  await page.waitForTimeout(Number(process.env.STEP || 900));
  const info = await page.evaluate(() => {
    const sec = document.querySelector("section[role=region]");
    return { label: sec?.getAttribute("aria-label"), text: (sec?.innerText || "").slice(0, 60).replace(/\n/g, " | "), opacity: sec ? [...sec.querySelectorAll("div")].slice(0, 6).map((d) => getComputedStyle(d).opacity).join(",") : null };
  });
  console.log(i, JSON.stringify(info));
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.screenshot({ path: `${OUT}/searching-orbit-${W}${i ? "-" + i : ""}.png` });
}
await browser.close();
