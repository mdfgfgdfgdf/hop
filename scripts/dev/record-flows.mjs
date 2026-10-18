/**
 * Records the rider and driver journeys as MP4 videos, driving the real UI and
 * API of a running dev server. Frames come from Chrome's screencast (CDP) and
 * are encoded with the system ffmpeg. Demo data only.
 *
 *   node scripts/dev/record-flows.mjs <baseUrl> <outDir> [rider|driver|both]
 *
 * Needs PW_CHROMIUM_PATH (or a Playwright Chromium) and ffmpeg on PATH.
 */
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [base = "http://localhost:3000", outDir = "./artifacts/videos", which = "both"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const PICKUP = { lat: 32.0752, lng: 34.7751, address: "דיזנגוף סנטר, תל אביב" };
const DROPOFF = { lat: 32.0807, lng: 34.7805, address: "כיכר רבין, תל אביב" };
const PHONE = { width: 390, height: 844 };
const ACCOUNTS = {
  admin: { email: "admin@hop.local", password: "Admin1234!" },
  rider: { email: "rider@hop.local", password: "Rider1234!" },
  driver: { email: "driver@hop.local", password: "Driver1234!" },
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

async function apiContext(account) {
  const ctx = await browser.newContext({ baseURL: base });
  const res = await ctx.request.post("/api/auth/login", { data: account });
  if (!res.ok()) throw new Error(`login ${account.email} → ${res.status()}`);
  return ctx;
}

async function settings(patch) {
  const admin = await apiContext(ACCOUNTS.admin);
  const res = await admin.request.put("/api/admin/settings", { data: patch });
  if (!res.ok()) throw new Error(`settings → ${res.status()}`);
  await admin.close();
}

async function cancelActive(account) {
  const ctx = await apiContext(account);
  const r = await (await ctx.request.get("/api/rides/active")).json();
  if (r.ride?.id) {
    const url = account === ACCOUNTS.driver ? `/api/driver/rides/${r.ride.id}/cancel` : `/api/rides/${r.ride.id}/cancel`;
    await ctx.request.post(url, { data: { reason: "other" } }).catch(() => {});
  }
  await ctx.close();
}

async function recordingContext(account, geo = PICKUP) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: PHONE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    geolocation: { latitude: geo.lat, longitude: geo.lng },
    permissions: ["geolocation"],
  });
  const res = await ctx.request.post("/api/auth/login", { data: account });
  if (!res.ok()) throw new Error(`login ${account.email} → ${res.status()}`);
  return ctx;
}

/** Captures screencast frames with their timestamps until stop(). */
async function startCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ data: f.data, t: f.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: PHONE.width * 2, maxHeight: PHONE.height * 2, everyNthFrame: 1 });
  return {
    async stop() {
      await cdp.send("Page.stopScreencast").catch(() => {});
      return frames;
    },
  };
}

async function finish(ctx, capture, name) {
  const frames = await capture.stop();
  await ctx.close();
  const dir = fs.mkdtempSync(path.join(outDir, `${name}-frames-`));
  const list = [];
  frames.forEach((f, i) => {
    const file = path.join(dir, `${String(i).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    const next = frames[i + 1]?.t ?? f.t + 0.5;
    list.push(`file '${file}'`, `duration ${Math.max(0.01, Math.min(2, next - f.t)).toFixed(3)}`);
  });
  if (frames.length) list.push(`file '${path.join(dir, `${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
  const concat = path.join(dir, "frames.txt");
  fs.writeFileSync(concat, list.join("\n"));
  const mp4 = path.join(outDir, `${name}.mp4`);
  const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concat, "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-movflags", "+faststart", mp4]);
  fs.rmSync(dir, { recursive: true, force: true });
  if (ff.status !== 0) throw new Error(`ffmpeg failed: ${ff.stderr?.toString().slice(0, 300)}`);
  console.log(`saved ${mp4} (${frames.length} frames)`);
}

const pause = (page, ms) => page.waitForTimeout(ms);

// ───────────────────────── rider: book → match → ride → receipt → rate ─────────────────────────
async function rider() {
  await cancelActive(ACCOUNTS.rider);
  await settings({ "demo.autopilot": true, "demo.driverSpeedMps": 32, "demo.autopilotAcceptDelaySec": 3 });
  const ctx = await recordingContext(ACCOUNTS.rider);
  const page = await ctx.newPage();
  const capture = await startCapture(page);
  await page.goto("/ride");
  await page.getByTestId("destination-trigger").waitFor({ timeout: 60_000 });
  await pause(page, 2500);
  await page.getByTestId("destination-trigger").click();
  await pause(page, 700);
  await page.getByTestId("destination-input").pressSequentially("רבין", { delay: 140 });
  await page.getByTestId("search-results").getByText("כיכר רבין").first().click({ timeout: 30_000 });
  const order = page.getByTestId("order-button");
  await order.waitFor({ timeout: 60_000 });
  await pause(page, 3500);
  await order.click();
  await page.getByTestId("driver-card").first().waitFor({ timeout: 90_000 });
  await pause(page, 6000);
  await page.getByTestId("receipt-total").first().waitFor({ timeout: 180_000 });
  await pause(page, 3000);
  const five = page.getByRole("radio", { name: "5 כוכבים" });
  if (await five.count()) {
    await five.first().click();
    await pause(page, 800);
    await page.getByTestId("rate-submit").first().click().catch(() => {});
  }
  await pause(page, 2500);
  await finish(ctx, capture, "hop-rider-flow");
}

// ───────────────────────── driver: online → offer → pickup → trip → payout ─────────────────────────
async function driver() {
  await cancelActive(ACCOUNTS.rider);
  await cancelActive(ACCOUNTS.driver);
  await settings({ "demo.autopilot": false });
  const ctx = await recordingContext(ACCOUNTS.driver);
  const page = await ctx.newPage();
  const capture = await startCapture(page);
  try {
    await page.goto("/drive");
    const toggle = page.getByTestId("availability-switch");
    await toggle.waitFor({ timeout: 60_000 });
    await pause(page, 2500);
    if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
    await pause(page, 3000);

    const riderCtx = await apiContext(ACCOUNTS.rider);
    const quotes = await (await riderCtx.request.post("/api/quotes", { data: { pickup: PICKUP, dropoff: DROPOFF } })).json();
    const quote = quotes.quotes.find((q) => q.serviceType.id === "taxi");
    await riderCtx.request.post("/api/rides", { data: { quoteId: quote.id, paymentMethod: "card_demo" } });

    await page.getByTestId("offer-card").waitFor({ timeout: 60_000 });
    await pause(page, 3500);
    await page.getByTestId("offer-accept").click();
    const active = page.getByTestId("active-ride");
    await active.waitFor({ timeout: 30_000 });
    await pause(page, 3000);

    // arriving → arrived → start (the PIN is not required by default)
    for (let i = 0; i < 3; i++) {
      const before = await active.getAttribute("data-phase");
      await page.getByTestId("ride-step").click();
      for (let t = 0; t < 30 && (await active.getAttribute("data-phase")) === before; t++) await pause(page, 500);
      await pause(page, 2500);
    }
    // drive: move the phone's GPS along the route so the car glides on the map
    const route = quotes.route.polyline;
    for (let i = 0; i < route.length; i += Math.max(1, Math.floor(route.length / 14))) {
      await ctx.setGeolocation({ latitude: route[i][0], longitude: route[i][1] });
      await pause(page, 900);
    }
    await ctx.setGeolocation({ latitude: DROPOFF.lat, longitude: DROPOFF.lng });
    await pause(page, 1500);
    await page.getByTestId("ride-step").click();
    await page.getByTestId("confirm-complete").click();
    await page.getByTestId("ride-complete").waitFor({ timeout: 30_000 });
    await pause(page, 3500);
    await page.getByRole("radio", { name: "5 כוכבים" }).first().click();
    await page.getByTestId("rate-submit").click();
    await pause(page, 2000);
    await riderCtx.close();
  } finally {
    await settings({ "demo.autopilot": true });
  }
  await finish(ctx, capture, "hop-driver-flow");
}

try {
  if (which === "rider" || which === "both") await rider();
  if (which === "driver" || which === "both") await driver();
} finally {
  await browser.close();
}
