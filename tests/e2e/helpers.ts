import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

export const ACCOUNTS = {
  rider: { email: "rider@hop.local", password: "Rider1234!" },
  driver: { email: "driver@hop.local", password: "Driver1234!" },
  pendingDriver: { email: "driver.pending@hop.local", password: "Driver1234!" },
  support: { email: "support@hop.local", password: "Support1234!" },
  admin: { email: "admin@hop.local", password: "Admin1234!" },
} as const;

export const TLV = {
  dizengoff: { lat: 32.0752, lng: 34.7751, address: "דיזנגוף סנטר, תל אביב" },
  rabin: { lat: 32.0807, lng: 34.7805, address: "כיכר רבין, תל אביב" },
  savidor: { lat: 32.0838, lng: 34.798, address: "רכבת סבידור מרכז, תל אביב" },
};

/** Logs in through the API inside the browser context so the session cookie is set for page navigations. */
export async function loginViaApi(context: BrowserContext, account: { email: string; password: string }) {
  const res = await context.request.post("/api/auth/login", { data: account });
  expect(res.ok(), `login ${account.email}: ${res.status()}`).toBeTruthy();
  return (await res.json()).user as { id: string; role: string; name: string };
}

export async function signupViaApi(context: BrowserContext, input: { role: "rider" | "driver"; name: string; email: string; phone: string; password: string }) {
  const res = await context.request.post("/api/auth/signup", { data: { ...input, acceptTerms: true } });
  expect(res.ok(), `signup: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).user as { id: string; role: string };
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
}

/** Creates a quote + ride as the rider logged into `api`. Returns the ride DTO. */
export async function createRideViaApi(api: APIRequestContext, opts: { pickup?: typeof TLV.dizengoff; dropoff?: typeof TLV.rabin; serviceTypeId?: string; paymentMethod?: "cash" | "card_demo" } = {}) {
  const q = await api.post("/api/quotes", { data: { pickup: opts.pickup ?? TLV.dizengoff, dropoff: opts.dropoff ?? TLV.rabin } });
  expect(q.ok(), `quotes: ${q.status()} ${await q.text()}`).toBeTruthy();
  const quotes = (await q.json()).quotes as { id: string; serviceType: { id: string } }[];
  const quote = quotes.find((x) => x.serviceType.id === (opts.serviceTypeId ?? "taxi")) ?? quotes[0];
  const r = await api.post("/api/rides", { data: { quoteId: quote.id, paymentMethod: opts.paymentMethod ?? "cash" } });
  expect(r.ok(), `ride: ${r.status()} ${await r.text()}`).toBeTruthy();
  return (await r.json()).ride as { id: string; status: string };
}

export async function setAutopilot(context: BrowserContext, on: boolean, opts: { speedMps?: number; acceptDelaySec?: number } = {}) {
  const data: Record<string, boolean | number> = { "demo.autopilot": on };
  if (opts.speedMps != null) data["demo.driverSpeedMps"] = opts.speedMps;
  if (opts.acceptDelaySec != null) data["demo.autopilotAcceptDelaySec"] = opts.acceptDelaySec;
  const res = await context.request.put("/api/admin/settings", { data });
  expect(res.ok(), `settings: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** Polls /api/rides/active until the predicate matches (or the ride disappears). */
export async function waitForRide(api: APIRequestContext, predicate: (ride: { status: string } | null) => boolean, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await api.get("/api/rides/active");
    const { ride } = (await res.json()) as { ride: { status: string } | null };
    if (predicate(ride)) return ride;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("waitForRide: timeout");
}

export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(scrollWidth, "page should not scroll horizontally").toBeLessThanOrEqual(clientWidth + 1);
}

export async function expectRtl(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  const dir = await page.evaluate(() => getComputedStyle(document.body).direction);
  expect(dir).toBe("rtl");
}
