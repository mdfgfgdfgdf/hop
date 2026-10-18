/** Checks the overview with prefers-reduced-motion: numbers must render final values immediately. */
import { chromium } from "@playwright/test";
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "he-IL" });
await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: "admin@hop.local", password: "Admin1234!" } });
const overview = await (await ctx.request.get(`${BASE}/api/admin/overview`)).json();
const p = await ctx.newPage();
await p.goto(`${BASE}/admin`);
await p.waitForFunction(() => Object.keys(document).some((k) => k.startsWith("__reactContainer")));
await p.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
await p.waitForTimeout(150); // far shorter than the 1.1s count-up
const shown = await p.getByText("סה״כ משתמשים").locator("xpath=../..").innerText();
console.log(shown.includes(String(overview.totalUsers)) ? `PASS reduced motion shows final value ${overview.totalUsers} immediately` : `FAIL got: ${shown}`);
await b.close();
