/**
 * Driver app visual walkthrough (real API, autopilot OFF).
 *   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/dev/driver-shots.mjs [only]
 * Screens at iPhone 14 (390×844) and desktop (1380×900) into OUT.
 * `only` = comma list of sections: flow,cancel,decline,expire,pages,onboarding,signup,denied
 */
import { chromium, devices, request as pwRequest } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3002";
const OUT = process.env.OUT ?? "/tmp/claude-0/-home-user-hop/71bf8acf-8656-5cac-8fb7-200922f65bdb/scratchpad/driver";
const ONLY = (process.argv[2] ?? "flow,cancel,decline,expire,pages,onboarding,signup,denied").split(",");
const GEO = { latitude: 32.0752, longitude: 34.7751 };
const PICKUP = { lat: 32.0752, lng: 34.7751, address: "דיזנגוף סנטר" };
const DROPOFF = { lat: 32.0807, lng: 34.7805, address: "כיכר רבין" };
fs.mkdirSync(OUT, { recursive: true });

const NOISE = [/ERR_TUNNEL_CONNECTION_FAILED/, /style diff/, /GL Driver Message/, /\[HMR\]/, /Download the React DevTools/, /\[Fast Refresh\]/];
const consoleErrors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });

// One login per account (the API rate-limits logins per IP); contexts reuse the cookies.
const sessions = new Map();
async function api(email, password) {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const r = await ctx.post("/api/auth/login", { data: { email, password } });
  if (!r.ok()) throw new Error(`login ${email} ${r.status()}`);
  sessions.set(email, await ctx.storageState());
  return ctx;
}
async function stateFor(email, password) {
  if (!sessions.has(email)) await api(email, password);
  return sessions.get(email);
}
const admin = await api("admin@hop.local", "Admin1234!");
const rider = await api("rider@hop.local", "Rider1234!");
const driverApi = await api("driver@hop.local", "Driver1234!");
await admin.put("/api/admin/settings", { data: { "demo.autopilot": false } });

async function cleanup() {
  const { rides } = await (await admin.get("/api/admin/rides?status=active")).json();
  for (const r of rides ?? []) await admin.post(`/api/admin/rides/${r.id}/cancel`, { data: { reason: "ניקוי לפני צילומי מסך" } });
}
async function createRide(paymentMethod = "cash") {
  const q = await (await rider.post("/api/quotes", { data: { pickup: PICKUP, dropoff: DROPOFF } })).json();
  const quote = q.quotes.find((x) => x.serviceType.id === "taxi") ?? q.quotes[0];
  const res = await rider.post("/api/rides", { data: { quoteId: quote.id, paymentMethod } });
  const body = await res.json();
  if (!res.ok()) throw new Error("ride create failed " + JSON.stringify(body));
  return body.ride;
}

async function newPage(kind, email, password, { geo = true } = {}) {
  const opts = kind === "desktop" ? { viewport: { width: 1380, height: 900 } } : { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } };
  const storageState = email ? await stateFor(email, password) : undefined;
  const ctx = await browser.newContext({ ...opts, storageState, locale: "he-IL", timezoneId: "Asia/Jerusalem", ...(geo ? { geolocation: GEO, permissions: ["geolocation"] } : { permissions: [] }) });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !NOISE.some((re) => re.test(m.text()))) consoleErrors.push(`[${kind}] ${m.type()}: ${m.text().slice(0, 240)}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${kind}] pageerror: ${e.message}`));
  return page;
}
async function hydrated(page) {
  await page.waitForFunction(() => Object.keys(document).some((k) => k.startsWith("__reactContainer")), null, { timeout: 60_000 });
}
async function shot(page, name, { full = false, wait = 700 } = {}) {
  await sleep(wait);
  const kind = page.viewportSize().width > 800 ? "desktop" : "phone";
  await page.screenshot({ path: `${OUT}/${name}-${kind}.png`, fullPage: full });
  log("shot", `${name}-${kind}`);
}
async function both(pages, name, opts) {
  for (const p of pages) await shot(p, name, opts);
}

// ───────────────────────── main ride flow ─────────────────────────
if (ONLY.includes("flow") || ONLY.includes("cancel") || ONLY.includes("decline") || ONLY.includes("expire")) {
  await cleanup();
  await driverApi.post("/api/driver/availability", { data: { online: false } });
  const phone = await newPage("phone", "driver@hop.local", "Driver1234!");
  const desk = await newPage("desktop", "driver@hop.local", "Driver1234!");
  const pages = [phone, desk];
  for (const p of pages) {
    await p.goto(`${BASE}/drive`, { waitUntil: "domcontentloaded" });
    await hydrated(p);
  }
  await phone.getByTestId("availability-switch").waitFor({ timeout: 60_000 });
  await desk.getByTestId("availability-switch").waitFor({ timeout: 60_000 });
  await both(pages, "01-home-offline", { wait: 2500 });

  await phone.getByTestId("availability-switch").click();
  await phone.getByText("ממתינים להזמנות").first().waitFor();
  await desk.getByText("ממתינים להזמנות").first().waitFor({ timeout: 15_000 });
  await both(pages, "02-home-online", { wait: 1800 });

  await phone.getByTestId("menu-button").click();
  await shot(phone, "03-menu", { wait: 600 });
  await phone.keyboard.press("Escape");
  await sleep(400);

  if (ONLY.includes("flow")) {
    await sleep(5500); // let the UI post a fresh location
    const ride = await createRide("cash");
    log("ride", ride.id, ride.status);
    await phone.getByTestId("offer-card").waitFor({ timeout: 15_000 });
    await desk.getByTestId("offer-card").waitFor({ timeout: 15_000 });
    await both(pages, "04-offer", { wait: 1000 });
    await phone.getByTestId("offer-accept").click();
    await phone.getByTestId("active-ride").waitFor();
    await desk.getByTestId("active-ride").waitFor({ timeout: 15_000 });
    await both(pages, "05-accepted", { wait: 1200 });

    const step = async (name) => {
      const before = await phone.getByTestId("active-ride").getAttribute("data-phase");
      await phone.getByTestId("ride-step").click();
      await phone.waitForFunction((b) => document.querySelector("[data-testid=active-ride]")?.getAttribute("data-phase") !== b, before, { timeout: 10_000 });
      await sleep(1500);
      await both(pages, name, { wait: 600 });
    };
    await step("06-arriving");
    await step("07-arrived");
    await step("08-in-progress");
    await phone.getByTestId("ride-step").click();
    await phone.getByTestId("confirm-complete").waitFor();
    await shot(phone, "09-complete-confirm", { wait: 500 });
    await phone.getByTestId("confirm-complete").click();
    await phone.getByTestId("ride-complete").waitFor();
    await desk.getByTestId("ride-complete").waitFor({ timeout: 15_000 }).catch(() => log("desktop did not show completion (expected: completion is per-session)"));
    await both(pages, "10-completed", { wait: 1600 });
    await phone.getByRole("radio", { name: "5 כוכבים" }).click();
    await shot(phone, "11-rating", { wait: 400 });
    await phone.getByTestId("rate-submit").click();
    await phone.getByText("דירגתם את").waitFor();
    await shot(phone, "11b-rated", { wait: 600 });
    await phone.getByTestId("back-home").click();
    await phone.getByTestId("availability-switch").waitFor();
    await both(pages, "12-home-after", { wait: 2200 });
    fs.writeFileSync(`${OUT}/last-ride.txt`, ride.id);
  }

  if (ONLY.includes("cancel")) {
    await cleanup();
    await sleep(500);
    const ride = await createRide("card_demo");
    await phone.getByTestId("offer-card").waitFor({ timeout: 15_000 });
    await phone.getByTestId("offer-accept").click();
    await phone.getByTestId("active-ride").waitFor();
    await phone.getByTestId("ride-step").click(); // arriving
    await sleep(1200);
    await phone.getByTestId("ride-cancel").click();
    await phone.getByText("מה הסיבה?").waitFor();
    await phone.getByText("הנוסע לא הגיע לנקודת האיסוף").click();
    await shot(phone, "13-cancel-dialog", { wait: 400 });
    await phone.getByTestId("confirm-cancel").click();
    await phone.getByText("הנסיעה חזרה לתור").waitFor({ timeout: 10_000 });
    await shot(phone, "14-after-cancel", { wait: 600 });
    const st = await (await admin.get(`/api/admin/rides/${ride.id}`)).json();
    log("after driver cancel, ride status:", st.ride?.status);
    await cleanup();
  }

  if (ONLY.includes("decline")) {
    await cleanup();
    await sleep(600);
    await createRide("cash");
    await phone.getByTestId("offer-card").waitFor({ timeout: 15_000 });
    await phone.getByTestId("offer-decline").click();
    await phone.getByText("ההצעה נדחתה").waitFor({ timeout: 10_000 });
    await shot(phone, "15-declined-toast", { wait: 500 });
    await cleanup();
  }

  if (ONLY.includes("expire")) {
    await cleanup();
    await sleep(600);
    await createRide("cash");
    await phone.getByTestId("offer-card").waitFor({ timeout: 15_000 });
    await sleep(12_000);
    await shot(phone, "16-offer-late", { wait: 0 });
    await phone.getByText("ההצעה פגה").waitFor({ timeout: 20_000 });
    await shot(phone, "17-offer-expired-toast", { wait: 500 });
    await cleanup();
  }
  for (const p of pages) await p.context().close();
}

// ───────────────────────── content pages ─────────────────────────
if (ONLY.includes("pages")) {
  for (const kind of ["phone", "desktop"]) {
    const page = await newPage(kind, "driver@hop.local", "Driver1234!");
    await page.goto(`${BASE}/drive/earnings`, { waitUntil: "domcontentloaded" });
    await hydrated(page);
    await page.getByTestId("earnings-net").waitFor({ timeout: 60_000 });
    await shot(page, "20-earnings-today", { wait: 1800, full: true });
    await page.getByRole("tab", { name: "הכל" }).click();
    await shot(page, "21-earnings-all", { wait: 1800, full: true });

    await page.goto(`${BASE}/drive/history`, { waitUntil: "domcontentloaded" });
    await hydrated(page);
    await page.getByTestId("history-row").first().waitFor({ timeout: 60_000 });
    await shot(page, "22-history", { wait: 1000, full: true });
    await page.getByTestId("history-row").first().click();
    await page.getByTestId("report-incident").waitFor({ timeout: 60_000 });
    await shot(page, "23-history-detail", { wait: 1800, full: true });

    await page.goto(`${BASE}/drive/profile`, { waitUntil: "domcontentloaded" });
    await hydrated(page);
    await page.getByTestId("vehicle-summary").waitFor({ timeout: 60_000 });
    await shot(page, "24-profile", { wait: 1200, full: true });
    await page.getByTestId("vehicle-edit").click();
    await page.getByTestId("vehicle-save").waitFor();
    await shot(page, "24b-profile-vehicle-edit", { wait: 600 });

    await page.goto(`${BASE}/drive/support`, { waitUntil: "domcontentloaded" });
    await hydrated(page);
    await page.getByTestId("quick-safety").waitFor({ timeout: 60_000 });
    await shot(page, "25-support", { wait: 1000, full: true });
    if (kind === "phone") {
      await page.getByTestId("quick-safety").click();
      await page.getByTestId("new-ticket-form").waitFor();
      await page.getByTestId("ticket-body").fill("הנוסע התנהג בצורה מאיימת בסוף הנסיעה. מבקש שתחזרו אליי.");
      await shot(page, "26-new-ticket", { wait: 500, full: true });
      await page.getByTestId("ticket-submit").click();
      await page.getByTestId("reply-input").waitFor({ timeout: 30_000 });
      await page.getByTestId("reply-input").fill("עוד פרט: זה קרה ליד כיכר רבין בסביבות 21:00.");
      await page.getByRole("button", { name: "שליחה" }).click();
      await sleep(1200);
      await shot(page, "27-ticket-thread", { wait: 800, full: true });
    }
    await page.context().close();
  }
}

// ───────────────────────── onboarding states ─────────────────────────
if (ONLY.includes("onboarding")) {
  for (const [email, tag] of [["driver.pending@hop.local", "pending"], ["driver.rejected@hop.local", "rejected"]]) {
    for (const kind of ["phone", "desktop"]) {
      const page = await newPage(kind, email, "Driver1234!");
      await page.goto(`${BASE}/drive`, { waitUntil: "domcontentloaded" });
    await hydrated(page);
      await page.getByTestId("verification-status").waitFor({ timeout: 60_000 });
      await shot(page, `30-onboarding-${tag}-status`, { wait: 1500, full: kind === "desktop" });
      if (tag === "pending" && kind === "phone") {
        await page.getByTestId("step-2").click();
        await shot(page, `31-onboarding-${tag}-docs`, { wait: 1200, full: true });
      }
      await page.context().close();
    }
  }
}

// ───────────────────────── brand-new driver signup ─────────────────────────
if (ONLY.includes("signup")) {
  const page = await newPage("phone", null, null);
  const email = `new.driver.${Date.now()}@hop.local`;
  await page.goto(`${BASE}/signup?role=driver`, { waitUntil: "domcontentloaded" });
    await hydrated(page);
  await page.getByLabel("שם מלא").fill("נועה לוי");
  await page.getByLabel("אימייל").fill(email);
  await page.getByLabel("טלפון נייד").fill("0527771234");
  await page.getByLabel("סיסמה").fill("Driver1234!");
  await page.locator("input[type=checkbox]").check();
  await page.getByTestId("signup-submit").click();
  await page.waitForURL(/\/drive\/onboarding/, { timeout: 60_000 });
  await page.getByTestId("vehicle-save").waitFor({ timeout: 60_000 });
  await shot(page, "40-signup-onboarding-step1", { wait: 1200, full: true });
  await page.getByTestId("vehicle-save").click();
  await shot(page, "41-signup-validation", { wait: 600, full: true });
  await page.getByLabel("יצרן").fill("טויוטה");
  await page.getByLabel("דגם").fill("קורולה הייבריד");
  await page.getByLabel("צבע").fill("כסוף");
  await page.getByLabel("מספר רישוי").fill("123-45-678");
  await page.getByLabel("שנת ייצור").selectOption("2023");
  await page.getByText("מונית", { exact: true }).click();
  await page.getByTestId("vehicle-save").click();
  await page.getByTestId("docs-progress").waitFor({ timeout: 20_000 });
  await shot(page, "42-signup-docs", { wait: 1000, full: true });
  // upload one document (tiny PNG)
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await page.getByTestId("upload-id_card").setInputFiles({ name: "teudat-zehut.png", mimeType: "image/png", buffer: png });
  await page.getByTestId("doc-id_card").getByText("ממתין לבדיקה").waitFor({ timeout: 20_000 });
  await shot(page, "43-signup-doc-uploaded", { wait: 800, full: true });
  await page.context().close();
  const d = await newPage("desktop", email, "Driver1234!");
  await d.goto(`${BASE}/drive/onboarding`, { waitUntil: "domcontentloaded" });
    await hydrated(d);
  await d.getByTestId("docs-progress").waitFor({ timeout: 60_000 });
  await shot(d, "44-signup-docs", { wait: 1500, full: true });
  await d.context().close();
}

// ───────────────────────── geolocation denied ─────────────────────────
if (ONLY.includes("denied")) {
  await driverApi.post("/api/driver/availability", { data: { online: false } });
  const page = await newPage("phone", "driver@hop.local", "Driver1234!", { geo: false });
  await page.goto(`${BASE}/drive`, { waitUntil: "domcontentloaded" });
    await hydrated(page);
  await page.getByTestId("availability-switch").waitFor({ timeout: 60_000 });
  await sleep(1500);
  await page.getByTestId("availability-switch").click();
  await sleep(1500);
  await shot(page, "50-geo-denied", { wait: 300 });
  await page.context().close();
}

await browser.close();
console.log("\nConsole errors/warnings (filtered):", consoleErrors.length ? "\n" + [...new Set(consoleErrors)].join("\n") : "none");
