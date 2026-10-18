/**
 * Drives the main admin/support actions through the UI against the dev server.
 *   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/dev/admin-flows.mjs
 * Writes flow-*.png into OUT_DIR and prints a pass/fail line per step.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3003";
const OUT = process.env.OUT_DIR ?? "/tmp/claude-0/-home-user-hop/71bf8acf-8656-5cac-8fb7-200922f65bdb/scratchpad/admin";
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const results = [];
const errors = [];

async function session(email, password, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: "he-IL", timezoneId: "Asia/Jerusalem" });
  const r = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  if (!r.ok()) throw new Error(`login ${email} ${r.status()}`);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e}`));
  page.on("console", (m) => m.type() === "error" && !/hmr|ERR_TUNNEL|status of 4\d\d/.test(m.text()) && errors.push(`${email}: ${m.text().slice(0, 200)}`));
  return { ctx, page, api: async (p, init) => (await ctx.request.fetch(BASE + p, init)).json() };
}

async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e).split("\n")[0].slice(0, 240)}`);
  }
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/flow-${name}.png` });
const settle = async (page) => {
  await page.waitForFunction(() => Object.keys(document).some((k) => k.startsWith("__reactContainer")), null, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 }).catch(() => {});
};
const hideDevBadge = (page) => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

const admin = await session("admin@hop.local", "Admin1234!");
const { page } = admin;

// ── drivers: document review + approve with missing docs (409) ──
const drivers = (await admin.api("/api/admin/drivers?limit=100")).drivers;
const pending = drivers.find((d) => d.user.email === "driver.pending@hop.local");
await step("driver: approve one document via dialog", async () => {
  await page.goto(`${BASE}/admin/drivers/${pending.user.id}`);
  await settle(page);
  await hideDevBadge(page);
  await page.getByRole("button", { name: "אישור", exact: true }).first().click();
  await page.getByRole("dialog").getByRole("textbox").fill("נבדק מול המקור");
  await shot(page, "doc-approve-dialog");
  await page.getByRole("dialog").getByRole("button", { name: "אישור מסמך" }).click();
  await page.getByText("המסמך אושר").waitFor({ timeout: 8000 });
});
await step("driver: approve with missing docs shows 409 list", async () => {
  await page.getByRole("button", { name: "אישור נהג" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "אישור נהג" }).click();
  await page.getByText("מסמכים שטרם אושרו").waitFor({ timeout: 8000 });
  await shot(page, "driver-missing-docs");
  await page.keyboard.press("Escape");
});

// ── tickets: assign, internal note, reply, status ──
const tickets = (await admin.api("/api/admin/tickets?limit=50")).tickets;
const urgent = tickets.find((t) => t.priority === "urgent") ?? tickets[0];
await step("ticket: assign to me + internal note + reply + resolve", async () => {
  await page.goto(`${BASE}/admin/tickets/${urgent.id}`);
  await settle(page);
  await hideDevBadge(page);
  if (await page.getByRole("button", { name: "שייך אליי" }).isVisible()) {
    await page.getByRole("button", { name: "שייך אליי" }).click();
    await page.getByText("הפנייה שויכה אליכם").waitFor({ timeout: 8000 });
  }
  await page.getByRole("switch", { name: "הערה פנימית" }).click();
  await page.locator("#reply").fill("בדקתי את מסלול הנסיעה — המהירות הממוצעת חריגה. מעביר לבדיקת בטיחות.");
  await page.getByRole("button", { name: "שמירת הערה" }).click();
  await page.getByText("ההערה הפנימית נשמרה").waitFor({ timeout: 8000 });
  await page.getByRole("switch", { name: "הערה פנימית" }).click();
  await page.locator("#reply").fill("תודה שדיווחת. אנחנו בודקים את הנסיעה מול הנהג ונחזור אלייך תוך 24 שעות.");
  await page.getByRole("button", { name: "שליחת תשובה" }).click();
  await page.getByText("התשובה נשלחה").waitFor({ timeout: 8000 });
  await page.waitForTimeout(600);
  await shot(page, "ticket-conversation");
  await page.locator("#ticket-status").selectOption("resolved");
  await page.getByText("הסטטוס עודכן").waitFor({ timeout: 8000 });
});

// ── rides: refund on a completed ride; cancel an active ride ──
const rides = (await admin.api("/api/admin/rides?limit=50")).rides;
const done = rides.find((r) => r.status === "completed" && r.refundedAgorot === 0);
await step("ride: partial refund with confirmation", async () => {
  await page.goto(`${BASE}/admin/rides/${done.id}`);
  await settle(page);
  await hideDevBadge(page);
  await page.getByRole("button", { name: "החזר כספי" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("סכום ההחזר (₪) *").fill("5");
  await dlg.getByRole("textbox").nth(1).fill("עיכוב באיסוף — פיצוי לנוסע");
  await dlg.getByRole("button", { name: "המשך לאישור" }).click();
  await shot(page, "ride-refund-confirm");
  await dlg.getByRole("button", { name: "ביצוע ההחזר" }).click();
  await page.getByText("בוצע החזר").waitFor({ timeout: 8000 });
  await page.waitForTimeout(800);
  await shot(page, "ride-after-refund");
});
await step("ride: cancel an active ride", async () => {
  const rider = await browser.newContext();
  await rider.request.post(`${BASE}/api/auth/login`, { data: { email: "rider2@hop.local", password: "Rider1234!" } });
  const q = await (await rider.request.post(`${BASE}/api/quotes`, { data: { pickup: { lat: 32.0629, lng: 34.77, address: "רוטשילד 1" }, dropoff: { lat: 32.0523, lng: 34.7505, address: "נמל יפו" } } })).json();
  const created = await (await rider.request.post(`${BASE}/api/rides`, { data: { quoteId: q.quotes[0].id, paymentMethod: "cash" } })).json();
  await rider.close();
  await page.goto(`${BASE}/admin/rides/${created.ride.id}`);
  await settle(page);
  await page.getByRole("button", { name: "ביטול נסיעה" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("בקשת הנוסע במוקד");
  await page.getByRole("dialog").getByRole("button", { name: "ביטול הנסיעה" }).click();
  await page.getByText("הנסיעה בוטלה").first().waitFor({ timeout: 8000 });
});

// ── pricing: edit → preview → diff confirm → save; then restore ──
await step("pricing: save new version with diff dialog", async () => {
  await page.goto(`${BASE}/admin/pricing`);
  await settle(page);
  await hideDevBadge(page);
  const base = page.getByLabel("דמי התחלה");
  const original = await base.inputValue();
  await base.fill("13");
  await page.waitForTimeout(300);
  await shot(page, "pricing-edited");
  await page.getByRole("button", { name: "שמירה כגרסה חדשה" }).click();
  await page.getByRole("dialog").getByText("דמי התחלה").waitFor();
  await shot(page, "pricing-diff-dialog");
  await page.getByRole("dialog").getByRole("button", { name: "שמירת גרסה חדשה" }).click();
  await page.getByText("נשמרה גרסת תעריף חדשה").waitFor({ timeout: 8000 });
  await settle(page);
  await page.getByLabel("דמי התחלה").fill(original);
  await page.getByRole("button", { name: "שמירה כגרסה חדשה" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "שמירת גרסה חדשה" }).click();
  await page.getByText("נשמרה גרסת תעריף חדשה").first().waitFor({ timeout: 8000 });
});
await step("pricing: turning off demo shows strong warning", async () => {
  await settle(page);
  await page.getByRole("switch", { name: "תעריף הדגמה" }).click();
  await page.getByRole("button", { name: "שמירה כגרסה חדשה" }).click();
  await page.getByRole("dialog").getByText("התעריף יוצג כרשמי.").waitFor();
  await shot(page, "pricing-demo-off-warning");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "ביטול שינויים" }).click();
});
await step("service types: unapproved toggle is disabled", async () => {
  const sw = page.getByRole("switch", { name: /שיתוף נסיעות/ });
  if (!(await sw.isDisabled())) throw new Error("rideshare toggle should be disabled");
});

// ── settings ──
await step("settings: change + confirm + restore", async () => {
  await page.goto(`${BASE}/admin/settings`);
  await settle(page);
  const f = page.getByLabel("זמן לתגובת נהג להצעה");
  const orig = await f.inputValue();
  await f.fill("25");
  await page.getByRole("button", { name: "שמירת הגדרות" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "שמירת הגדרות" }).click();
  await page.getByText("ההגדרות נשמרו").waitFor({ timeout: 8000 });
  await settle(page);
  await page.getByLabel("זמן לתגובת נהג להצעה").fill(orig);
  await page.getByRole("button", { name: "שמירת הגדרות" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "שמירת הגדרות" }).click();
  await page.getByText("ההגדרות נשמרו").first().waitFor({ timeout: 8000 });
});

// ── users: suspend + activate ──
const r2 = (await admin.api("/api/admin/users?q=rider2")).users[0];
await step("user: suspend with reason then reactivate", async () => {
  await page.goto(`${BASE}/admin/users/${r2.id}`);
  await settle(page);
  await hideDevBadge(page);
  await page.getByRole("button", { name: "השעיית משתמש" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("בדיקת זרימה — חשד לשימוש לרעה");
  await shot(page, "user-suspend-dialog");
  await page.getByRole("dialog").getByRole("button", { name: "השעיית משתמש" }).click();
  await page.getByText("המשתמש הושעה").waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "הפעלת חשבון" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "הפעלת חשבון" }).click();
  await page.getByText("החשבון הופעל").waitFor({ timeout: 8000 });
});
await admin.ctx.close();

// ── support: read-only pricing/settings, no role change, API 403 ──
const support = await session("support@hop.local", "Support1234!");
await step("support: pricing read-only + admin note", async () => {
  await support.page.goto(`${BASE}/admin/pricing`);
  await settle(support.page);
  await support.page.getByText("דורש הרשאת מנהל").first().waitFor();
  if (!(await support.page.getByLabel("דמי התחלה").isDisabled())) throw new Error("input should be disabled");
  if (await support.page.getByRole("button", { name: "שמירה כגרסה חדשה" }).count()) throw new Error("save should be hidden");
});
await step("support: settings read-only", async () => {
  await support.page.goto(`${BASE}/admin/settings`);
  await settle(support.page);
  if (!(await support.page.getByLabel("זמן לתגובת נהג להצעה").isDisabled())) throw new Error("input should be disabled");
});
await step("support: role select disabled on user page", async () => {
  await support.page.goto(`${BASE}/admin/users/${r2.id}`);
  await settle(support.page);
  if (!(await support.page.locator("#role-select").isDisabled())) throw new Error("role select should be disabled");
});
await step("support: API rejects pricing update with 403", async () => {
  const r = await support.ctx.request.put(`${BASE}/api/admin/pricing`, { data: { baseFareAgorot: 1 } });
  if (r.status() !== 403) throw new Error(`expected 403, got ${r.status()}`);
});
await support.ctx.close();
await browser.close();

console.log(results.join("\n"));
console.log(errors.length ? `\nPage errors (${errors.length}):\n${errors.join("\n")}` : "\nNo page errors.");
