/**
 * Screenshots every admin screen as admin and as support at desktop / iPad / iPhone.
 *   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/dev/admin-shots.mjs [--only=overview,drivers] [--roles=admin,support] [--sizes=desktop,ipad,iphone]
 * Env: BASE_URL (default http://localhost:3001), OUT_DIR.
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Use "localhost": Next 16 dev blocks /_next dev resources for the 127.0.0.1 origin (no hydration).
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT = process.env.OUT_DIR ?? "/tmp/claude-0/-home-user-hop/71bf8acf-8656-5cac-8fb7-200922f65bdb/scratchpad/rider-v2/admin";
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1]?.split(",").filter(Boolean);
const only = arg("only");
const roles = arg("roles") ?? ["admin", "support"];
const sizes = arg("sizes") ?? ["desktop", "ipad", "iphone"];
mkdirSync(OUT, { recursive: true });

const ACCOUNTS = {
  admin: { email: "admin@hop.local", password: "Admin1234!" },
  support: { email: "support@hop.local", password: "Support1234!" },
};
const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  ipad: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  iphone: { ...devices["iPhone 14"], defaultBrowserType: undefined },
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const problems = [];

async function resolveIds(request) {
  const j = async (p) => (await request.get(BASE + p)).json();
  const drivers = (await j("/api/admin/drivers?limit=200")).drivers ?? [];
  const pending = drivers.find((d) => d.profile.verificationStatus === "under_review") ?? drivers[0];
  const approved = drivers.find((d) => d.profile.verificationStatus === "approved") ?? drivers[0];
  const rides = (await j("/api/admin/rides?limit=50")).rides ?? [];
  const ride = rides.find((r) => r.status === "completed" && r.flags?.length) ?? rides.find((r) => r.status === "completed") ?? rides[0];
  const activeRide = rides.find((r) => !["completed", "cancelled"].includes(r.status));
  const users = (await j("/api/admin/users?role=rider&limit=20")).users ?? [];
  const tickets = (await j("/api/admin/tickets?limit=50")).tickets ?? [];
  return { pending: pending?.user.id, approved: approved?.user.id, ride: ride?.id, activeRide: activeRide?.id, rider: users[0]?.id, ticket: tickets[0]?.id };
}

function routes(ids) {
  return [
    ["overview", "/admin"],
    ["drivers", "/admin/drivers"],
    ["driver-pending", ids.pending && `/admin/drivers/${ids.pending}`],
    ["driver-approved", ids.approved && `/admin/drivers/${ids.approved}`],
    ["users", "/admin/users"],
    ["user", ids.rider && `/admin/users/${ids.rider}`],
    ["rides", "/admin/rides"],
    ["ride", ids.ride && `/admin/rides/${ids.ride}`],
    ["ride-active", ids.activeRide && `/admin/rides/${ids.activeRide}`],
    ["tickets", "/admin/tickets"],
    ["ticket", ids.ticket && `/admin/tickets/${ids.ticket}`],
    ["pricing", "/admin/pricing"],
    ["reports", "/admin/reports"],
    ["audit", "/admin/audit"],
    ["settings", "/admin/settings"],
  ].filter(([name, url]) => url && (!only || only.includes(name)));
}

for (const role of roles) {
  for (const size of sizes) {
    const ctx = await browser.newContext({ ...SIZES[size], locale: "he-IL", timezoneId: "Asia/Jerusalem" });
    const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: ACCOUNTS[role] });
    if (!login.ok()) throw new Error(`login failed for ${role}: ${login.status()}`);
    const ids = await resolveIds(ctx.request);
    const page = await ctx.newPage();
    let current = "";
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("/_next/hmr") && !m.text().includes("ERR_TUNNEL_CONNECTION_FAILED")) problems.push(`[${role}/${size}/${current}] console: ${m.text().slice(0, 300)}`);
    });
    page.on("pageerror", (e) => problems.push(`[${role}/${size}/${current}] pageerror: ${String(e).slice(0, 300)}`));
    for (const [name, url] of routes(ids)) {
      current = name;
      await page.goto(BASE + url, { waitUntil: "load" }).catch((e) => problems.push(`[${role}/${size}/${name}] goto: ${e}`));
      await page.waitForFunction(() => Object.keys(document).some((k) => k.startsWith("__reactContainer")), null, { timeout: 20000 }).catch(() => problems.push(`[${role}/${size}/${name}] not hydrated`));
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 }).catch(() => problems.push(`[${role}/${size}/${name}] still loading after 15s`));
      await page.waitForTimeout(900);
      // Hide the Next.js dev-tools badge so it doesn't cover content in screenshots.
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
      const overflow = await page.evaluate(() => (document.documentElement ? document.documentElement.scrollWidth - document.documentElement.clientWidth : 0)).catch(() => 0);
      if (overflow > 1) problems.push(`[${role}/${size}/${name}] horizontal page overflow ${overflow}px`);
      await page.screenshot({ path: `${OUT}/${role}-${size}-${name}.png`, fullPage: true }).catch((e) => problems.push(`[${role}/${size}/${name}] screenshot: ${e}`));
      if (name === "overview" && size !== "desktop") {
        const menu = page.getByRole("button", { name: "פתיחת תפריט" });
        if (await menu.isVisible().catch(() => false)) {
          await menu.click();
          await page.waitForTimeout(600);
          await page.screenshot({ path: `${OUT}/${role}-${size}-drawer.png` });
          await page.keyboard.press("Escape");
          await page.getByRole("button", { name: "סגירת התפריט" }).click().catch(() => {});
        }
      }
    }
    await ctx.close();
    console.log(`done ${role}/${size}`);
  }
}
await browser.close();
console.log(problems.length ? `\nProblems (${problems.length}):\n` + problems.join("\n") : "\nNo console errors / overflow detected.");
