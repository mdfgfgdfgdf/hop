// Rider app visual walkthrough (real API + demo autopilot).
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/dev/rider-shots.mjs
// Screens go to $OUT_DIR (default: session scratchpad). Phone (iPhone 14) drives
// the order; a desktop (1380×900) page mirrors every state.
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = process.env.OUT_DIR || "/tmp/claude-0/-home-user-hop/71bf8acf-8656-5cac-8fb7-200922f65bdb/scratchpad/rider";
const SUFFIX = process.env.PHONE_H ? `-h${process.env.PHONE_H}` : "";
const ONLY = process.env.ONLY || "all"; // all | flow | pages | errors
fs.mkdirSync(OUT, { recursive: true });
// Carmel Market: a few hundred metres from the nearest demo driver, so the
// "driver arriving" phase lasts long enough to capture.
const GEO = { latitude: Number(process.env.GEO_LAT || 32.0685), longitude: Number(process.env.GEO_LNG || 34.7683) };
const consoleErrors = [];
let lastShot = "start";

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });

// Log in once and reuse the session cookie (the login endpoint is rate limited).
const STATE = `${OUT}/.rider-session.json`;
async function sessionState() {
  if (fs.existsSync(STATE)) {
    const probe = await browser.newContext({ storageState: STATE });
    const me = await (await probe.request.get(`${BASE}/api/auth/me`)).json().catch(() => null);
    await probe.close();
    if (me?.user?.role === "rider") return STATE;
  }
  const ctx = await browser.newContext();
  const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: "rider@hop.local", password: "Rider1234!" } });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  await ctx.storageState({ path: STATE });
  await ctx.close();
  return STATE;
}
async function makeCtx(label, opts, geo = GEO) {
  return browser.newContext({ ...opts, storageState: await sessionState(), locale: "he-IL", timezoneId: "Asia/Jerusalem", ...(geo ? { permissions: ["geolocation"], geolocation: geo } : {}) });
}
function watch(page, label) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/ERR_TUNNEL_CONNECTION_FAILED|tiles\.openfreemap|Failed to load resource: net::ERR/.test(t)) return; // tiles blocked in sandbox → offline map
    if (/status of 400/.test(t)) return; // deliberate invalid promo / outside-area quotes
    consoleErrors.push(`[${label}] after "${lastShot}": ${t.slice(0, Number(process.env.MAXLEN || 300))}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${label}] pageerror ${e.message}`));
}
const hydrated = (page) => page.waitForFunction(() => Object.keys(document).some((k) => k.startsWith("__reactContainer")), null, { timeout: 20000 });
const shot = async (page, name, label) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}-${label}${SUFFIX}.png` });
  console.log("shot", name, label);
  lastShot = `${name}-${label}`;
};
async function active(ctx) {
  const r = await ctx.request.get(`${BASE}/api/rides/active`);
  return (await r.json()).ride;
}
async function cancelActive(ctx) {
  const ride = await active(ctx);
  if (ride && ride.status !== "in_progress") await ctx.request.post(`${BASE}/api/rides/${ride.id}/cancel`, { data: { reason: "test reset" } });
  else if (ride) {
    console.log("waiting for in-progress ride to finish…");
    for (let i = 0; i < 90 && (await active(ctx)); i++) await new Promise((r) => setTimeout(r, 2000));
  }
}
async function waitFor(ctx, pred, label, timeoutMs = 180_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ride = await active(ctx);
    if (pred(ride)) return ride;
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`timeout waiting for ${label}`);
}

const PHONE = { ...devices["iPhone 14"], viewport: { width: 390, height: Number(process.env.PHONE_H || 844) } };
const phoneCtx = await makeCtx("phone", PHONE);
const deskCtx = await makeCtx("desktop", { viewport: { width: 1380, height: 900 } });
await cancelActive(phoneCtx);
const phone = await phoneCtx.newPage();
const desk = await deskCtx.newPage();
watch(phone, "phone");
watch(desk, "desktop");

async function both(fn) {
  await Promise.all([fn(phone, "phone"), fn(desk, "desktop")]);
}

if (ONLY === "all" || ONLY === "flow") {
  // 1. home
  await both(async (p, l) => {
    await p.goto(`${BASE}/ride`, { waitUntil: "domcontentloaded" });
    await hydrated(p);
    await p.getByTestId("destination-trigger").waitFor();
    await p.waitForTimeout(1500);
    await shot(p, "01-home", l);
  });
  // account menu
  await both(async (p, l) => {
    await p.getByTestId("account-menu").click();
    await shot(p, "02-menu", l);
    await p.keyboard.press("Escape");
  });
  // 2. destination search
  await both(async (p, l) => {
    await p.getByTestId("destination-trigger").click();
    await p.getByTestId("destination-input").waitFor();
    await shot(p, "03-search-empty", l);
    await p.getByTestId("destination-input").fill("רבין");
    await p.getByTestId("search-results").getByText("כיכר רבין").waitFor();
    await shot(p, "04-search-results", l);
    await p.getByTestId("search-results").getByText("כיכר רבין").click();
  });
  // 3. quote
  await both(async (p, l) => {
    await p.getByTestId("order-button").getByText("הזמנת").waitFor({ timeout: 15000 });
    await p.waitForTimeout(900);
    await shot(p, "05-quote", l);
  });
  await phone.getByRole("button", { name: "פירוט המחיר" }).click();
  await shot(phone, "06-quote-breakdown", "phone");
  await phone.getByRole("button", { name: /קוד קופון/ }).click();
  await phone.getByLabel("קוד קופון").fill("NOPE");
  await phone.getByRole("button", { name: "החלה" }).click();
  await phone.getByText("הקוד אינו תקף").waitFor();
  await shot(phone, "07-promo-invalid", "phone");
  await phone.getByLabel("קוד קופון").fill("HOP10");
  await phone.getByRole("button", { name: "החלה" }).click();
  await phone.getByText("הופעל").waitFor();
  await shot(phone, "08-promo-applied", "phone");
  // 4. pickup pin (desktop) then back
  await desk.getByRole("button", { name: "שינוי נקודת האיסוף" }).click();
  await desk.getByTestId("pin-confirm").waitFor();
  await desk.waitForTimeout(1200);
  await shot(desk, "09-pin-pickup", "desktop");
  await desk.getByTestId("pin-confirm").click();
  await desk.getByTestId("order-button").getByText("הזמנת").waitFor({ timeout: 15000 });
  // phone pin too (then back)
  await phone.getByRole("button", { name: "שינוי נקודת האיסוף" }).click();
  await phone.getByTestId("pin-confirm").waitFor();
  await phone.waitForTimeout(1200);
  await shot(phone, "09-pin-pickup", "phone");
  await phone.getByTestId("pin-confirm").click();
  await phone.getByTestId("order-button").getByText("הזמנת").waitFor({ timeout: 15000 });
  await phone.waitForTimeout(600);

  // 5. order → searching
  await phone.getByTestId("order-button").click();
  await phone.getByText(/מחפשים נהג|מצאנו נהג/).first().waitFor({ timeout: 15000 });
  await shot(phone, "10-searching", "phone");
  await desk.goto(`${BASE}/ride`, { waitUntil: "domcontentloaded" });
  await desk.getByText(/מחפשים נהג|מצאנו נהג|בדרך אליך|אושרה/).first().waitFor({ timeout: 15000 }).catch(() => {});
  await shot(desk, "10-searching", "desktop");

  // 6. accepted / arriving
  await waitFor(phoneCtx, (r) => r && (r.status === "driver_arriving" || r.status === "accepted"), "driver accepted");
  await phone.getByTestId("driver-card").waitFor({ timeout: 15000 });
  await phone.waitForTimeout(2500);
  await shot(phone, "11-arriving", "phone");
  await desk.getByTestId("driver-card").waitFor({ timeout: 15000 });
  await shot(desk, "11-arriving", "desktop");
  // cancel + safety dialogs (cancel first: it disappears once the ride starts)
  if (await phone.getByTestId("cancel-ride").count()) {
    await phone.getByTestId("cancel-ride").click();
    await shot(phone, "14-cancel-confirm", "phone");
    await phone.getByRole("button", { name: "לא, להמשיך" }).click();
  } else console.log("ride already started — skipping cancel dialog shot");
  await phone.getByRole("button", { name: "בטיחות" }).click();
  await shot(phone, "12-safety", "phone");
  await phone.getByRole("dialog").getByRole("textbox").fill("בדיקת דיווח בטיחות מהסקריפט — אפשר לסגור");
  await phone.getByTestId("safety-submit").click();
  await phone.getByText("הדיווח נשלח").waitFor({ timeout: 10000 });
  await shot(phone, "13-safety-sent", "phone");
  // active chip on another page
  const other = await phoneCtx.newPage();
  watch(other, "phone-chip");
  await other.goto(`${BASE}/ride/history`, { waitUntil: "domcontentloaded" });
  await other.getByTestId("active-ride-chip").waitFor({ timeout: 15000 });
  await shot(other, "15-active-chip", "phone");
  await other.close();

  // arrived
  await waitFor(phoneCtx, (r) => r && (r.arrivedAt || r.status === "in_progress"), "driver arrived");
  await phone.waitForTimeout(1200);
  await shot(phone, "16-arrived", "phone");
  await shot(desk, "16-arrived", "desktop");

  // 7. in progress
  await waitFor(phoneCtx, (r) => r && r.status === "in_progress", "in progress");
  await phone.getByTestId("locked-price").waitFor({ timeout: 15000 });
  await phone.waitForTimeout(4000);
  await shot(phone, "17-in-progress", "phone");
  await desk.getByTestId("locked-price").waitFor({ timeout: 15000 });
  await shot(desk, "17-in-progress", "desktop");

  // 8. completed
  await waitFor(phoneCtx, (r) => !r, "completed", 240_000);
  await phone.getByTestId("rate-ride").waitFor({ timeout: 20000 });
  await phone.waitForTimeout(1200);
  await shot(phone, "18-completed", "phone");
  await desk.getByTestId("rate-ride").waitFor({ timeout: 20000 });
  await shot(desk, "18-completed", "desktop");
  await phone.getByRole("radio", { name: "5 כוכבים" }).click();
  await phone.getByLabel("הערה לדירוג").fill("נסיעה נעימה, תודה!");
  await shot(phone, "19-rating", "phone");
  await phone.getByTestId("rate-submit").click();
  await phone.getByText("תודה! דירגתם").waitFor({ timeout: 10000 });
  await shot(phone, "20-rated", "phone");
  await phone.getByTestId("back-home").click();
  await phone.getByTestId("destination-trigger").waitFor();
  await shot(phone, "21-home-recents", "phone");
}

if (ONLY === "all" || ONLY === "pages") {
  await both(async (p, l) => {
    await p.goto(`${BASE}/ride/history`, { waitUntil: "domcontentloaded" });
    await hydrated(p);
    await p.getByTestId("history-list").waitFor({ timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    await shot(p, "30-history", l);
    const first = p.getByTestId("history-item").first();
    if (await first.count()) {
      await first.click();
      await p.getByTestId("ride-detail").waitFor({ timeout: 15000 });
      await p.waitForTimeout(1500);
      await shot(p, "31-history-detail", l);
      await p.screenshot({ path: `${OUT}/31-history-detail-full-${l}.png`, fullPage: true });
    }
    await p.goto(`${BASE}/ride/settings`, { waitUntil: "domcontentloaded" });
    await hydrated(p);
    await p.getByTestId("settings").waitFor({ timeout: 15000 });
    await p.waitForTimeout(800);
    await shot(p, "32-settings", l);
    await p.screenshot({ path: `${OUT}/32-settings-full-${l}.png`, fullPage: true });
    await p.goto(`${BASE}/ride/support`, { waitUntil: "domcontentloaded" });
    await hydrated(p);
    await p.getByTestId("support").waitFor({ timeout: 15000 });
    await p.waitForTimeout(800);
    await shot(p, "33-support", l);
    await p.goto(`${BASE}/ride/support?new=1`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("ticket-form").waitFor({ timeout: 15000 });
    await shot(p, "34-support-new", l);
    const t = p.getByTestId("ticket-item").first();
    if (await t.count()) {
      await t.click();
      await p.getByTestId("ticket-thread").waitFor({ timeout: 15000 });
      await p.waitForTimeout(600);
      await shot(p, "35-ticket-thread", l);
    }
  });
}

if (ONLY === "all" || ONLY === "errors") {
  // pickup outside the service area (Jerusalem)
  const jctx = await makeCtx("phone-jlm", PHONE, { latitude: 31.7767, longitude: 35.2345 });
  await cancelActive(jctx);
  const j = await jctx.newPage();
  watch(j, "phone-jlm");
  await j.goto(`${BASE}/ride`, { waitUntil: "domcontentloaded" });
  await hydrated(j);
  await j.getByTestId("destination-trigger").click();
  await j.getByTestId("destination-input").fill("רבין");
  await j.getByTestId("search-results").getByText("כיכר רבין").click();
  await j.getByText("HOP עדיין לא פועלת כאן").waitFor({ timeout: 15000 });
  await shot(j, "40-outside-area", "phone");
  // geolocation denied → approximate location
  const nctx = await makeCtx("phone-nogeo", PHONE, null);
  const n = await nctx.newPage();
  watch(n, "phone-nogeo");
  await n.goto(`${BASE}/ride`, { waitUntil: "domcontentloaded" });
  await n.getByText("מיקום משוער").waitFor({ timeout: 15000 });
  await shot(n, "41-approx-location", "phone");
  await jctx.close();
  await nctx.close();
}

console.log("\nconsole errors:", consoleErrors.length ? "\n" + consoleErrors.join("\n") : "none");
await browser.close();
