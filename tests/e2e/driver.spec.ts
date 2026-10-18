import { expect, test } from "@playwright/test";
import { ACCOUNTS, cancelActiveRides, createRideViaApi, expectNoHorizontalOverflow, expectRtl, loginViaApi, setAutopilot } from "./helpers";

// driver@hop.local is seeded at Dizengoff Center; the rider ride is booked from there.
test.use({ geolocation: { latitude: 32.0752, longitude: 34.7751 }, permissions: ["geolocation"] });

test.describe("driver journey", () => {
  test.beforeEach(async ({ browser }) => {
    await cancelActiveRides(browser);
  });

  test.afterEach(async ({ browser }) => {
    const adminCtx = await browser.newContext();
    await loginViaApi(adminCtx, ACCOUNTS.admin);
    await setAutopilot(adminCtx, true);
    await adminCtx.close();
  });

  test("go online → receive offer → accept → arriving → arrived → start → complete → rate", async ({ page, context, browser }) => {
    test.setTimeout(240_000);
    const adminCtx = await browser.newContext();
    await loginViaApi(adminCtx, ACCOUNTS.admin);
    await setAutopilot(adminCtx, false); // drive manually
    await adminCtx.close();

    await loginViaApi(context, ACCOUNTS.driver);
    await page.goto("/drive");
    await expectRtl(page);
    const toggle = page.getByTestId("availability-switch");
    await expect(toggle).toBeVisible({ timeout: 30_000 });
    if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
    await expect(page.getByText("ממתינים להזמנות").first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    const riderCtx = await browser.newContext();
    await loginViaApi(riderCtx, ACCOUNTS.rider);
    const ride = await createRideViaApi(riderCtx.request);

    await expect(page.getByTestId("offer-card")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("offer-payout")).toContainText("₪");
    await page.getByTestId("offer-accept").click();
    const active = page.getByTestId("active-ride");
    await expect(active).toBeVisible({ timeout: 20_000 });

    // arriving → arrived → start
    for (let i = 0; i < 3; i++) {
      const before = await active.getAttribute("data-phase");
      await page.getByTestId("ride-step").click();
      await expect
        .poll(async () => active.getAttribute("data-phase"), { timeout: 15_000 })
        .not.toBe(before);
    }
    // complete (confirmation)
    await page.getByTestId("ride-step").click();
    await page.getByTestId("confirm-complete").click();
    await expect(page.getByTestId("ride-complete")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("completion-payout")).toContainText("₪");

    await page.getByRole("radio", { name: "5 כוכבים" }).click();
    await page.getByTestId("rate-submit").click();
    await page.getByTestId("back-home").click();
    await expect(page.getByTestId("availability-switch")).toBeVisible({ timeout: 20_000 });

    const done = await riderCtx.request.get(`/api/rides/${ride.id}`);
    expect((await done.json()).ride.status).toBe("completed");
    await riderCtx.close();
  });

  test("earnings, history and profile render; unapproved driver lands on onboarding", async ({ page, context }) => {
    await loginViaApi(context, ACCOUNTS.driver);
    await page.goto("/drive/earnings");
    await expect(page.getByTestId("earnings-net")).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalOverflow(page);
    await page.goto("/drive/history");
    await expect(page.getByTestId("history-row").first()).toBeVisible({ timeout: 30_000 });
    await page.goto("/drive/profile");
    await expect(page.getByTestId("vehicle-summary")).toBeVisible({ timeout: 30_000 });
    await context.request.post("/api/auth/logout");

    await loginViaApi(context, ACCOUNTS.pendingDriver);
    await page.goto("/drive");
    await expect(page).toHaveURL(/\/drive\/onboarding/, { timeout: 30_000 });
    await expectNoHorizontalOverflow(page);
  });
});
