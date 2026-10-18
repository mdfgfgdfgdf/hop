// Probe a rider page: logs console messages / navigations for a few seconds.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "http://localhost:3001";
const STATE = "/tmp/claude-0/-home-user-hop/71bf8acf-8656-5cac-8fb7-200922f65bdb/scratchpad/rider/.rider-session.json";
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, locale: "he-IL", timezoneId: "Asia/Jerusalem", storageState: fs.existsSync(STATE) ? STATE : undefined, permissions: ["geolocation"], geolocation: { latitude: 32.0685, longitude: 34.7683 } });
const page = await ctx.newPage();
let navs = 0;
page.on("framenavigated", (f) => { if (f === page.mainFrame()) navs++; });
page.on("console", (m) => { if (!/TUNNEL|Failed to load resource|DevTools/.test(m.text())) console.log("console", m.type(), m.text().slice(0, Number(process.env.MAXLEN || 300))); });
await page.goto(BASE + (process.argv[2] || "/ride"), { waitUntil: "domcontentloaded" });
await page.waitForTimeout(Number(process.argv[3] || 6000));
console.log("navigations:", navs);
await browser.close();
