import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoHorizontalOverflow, expectRtl, loginViaApi, setAutopilot, waitForRide } from "./helpers";

test.use({ geolocation: { latitude: 32.0685, longitude: 34.7683 }, permissions: ["geolocation"] });

test.describe("rider journey", () => {
  test("search → price → order → matched → driver arrives → ride → receipt → rating (demo autopilot)", async ({ page, context, browser }) => {
    test.setTimeout(240_000);
    const adminCtx = await browser.newContext();
    await loginViaApi(adminCtx, ACCOUNTS.admin);
    // Fast demo driver so the whole ride fits the test budget (the e2e DB is fresh per run).
    await setAutopilot(adminCtx, true, { speedMps: 90, acceptDelaySec: 1 });
    await adminCtx.close();

    await loginViaApi(context, ACCOUNTS.rider);
    await page.goto("/ride");
    await expectRtl(page);
    await expect(page.getByTestId("greeting")).toBeVisible();
    await expect(page.getByTestId("destination-trigger")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByTestId("destination-trigger").click();
    await page.getByTestId("destination-input").fill("רבין");
    await page.getByTestId("search-results").getByText("כיכר רבין").click();

    const order = page.getByTestId("order-button");
    await expect(order).toContainText("הזמנת", { timeout: 20_000 });
    await expect(order).toContainText("₪");
    await expect(page.getByText("תעריף הדגמה").first()).toBeVisible();

    await order.click();
    await expect(page.getByText(/מחפשים נהג|מצאנו נהג/).first()).toBeVisible({ timeout: 20_000 });

    await waitForRide(context.request, (r) => !!r && (r.status === "accepted" || r.status === "driver_arriving" || r.status === "in_progress"), 90_000);
    await expect(page.getByTestId("driver-card")).toBeVisible({ timeout: 20_000 });

    await waitForRide(context.request, (r) => !!r && r.status === "in_progress", 120_000);
    await expect(page.getByTestId("locked-price")).toBeVisible({ timeout: 20_000 });

    await waitForRide(context.request, (r) => r === null, 150_000); // completed → no active ride
    await expect(page.getByTestId("receipt-total")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("עמלת HOP").first()).toBeVisible();

    await page.getByRole("radio", { name: "5 כוכבים" }).click();
    await page.getByTestId("rate-submit").click();
    await expect(page.getByTestId("rate-submit")).toBeHidden({ timeout: 15_000 });
  });

  test("history, settings and support pages render", async ({ page, context }) => {
    await loginViaApi(context, ACCOUNTS.rider);
    await page.goto("/ride/history");
    await expect(page.getByTestId("history-list")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("history-item").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/ride/settings");
    await expect(page.getByTestId("settings")).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    await page.goto("/ride/support");
    await expect(page.getByTestId("support")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("new-ticket").click();
    await expect(page.getByTestId("ticket-form")).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalOverflow(page);
  });
});
