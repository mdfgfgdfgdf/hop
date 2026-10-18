import { expect, test } from "@playwright/test";
import { ACCOUNTS, cancelActiveRides, createRideViaApi, expectNoHorizontalOverflow, expectRtl, loginViaApi } from "./helpers";

test.describe("operator dashboard", () => {
  test.beforeEach(async ({ browser }) => {
    await cancelActiveRides(browser);
  });

  test("admin sees the overview KPIs, live map section and navigation", async ({ page, context }) => {
    await loginViaApi(context, ACCOUNTS.admin);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "סקירה" })).toBeVisible();
    await expect(page.getByText("נסיעות פעילות").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("עמלת HOP").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("תשלומים לנהגים").filter({ visible: true }).first()).toBeVisible();
    await expectRtl(page);
    await expectNoHorizontalOverflow(page);
  });

  test("drivers queue shows the pending driver and approval is blocked until documents are approved", async ({ page, context }) => {
    await loginViaApi(context, ACCOUNTS.admin);
    await page.goto("/admin/drivers");
    await expect(page.getByRole("heading", { level: 1, name: "נהגים" })).toBeVisible();
    await expect(page.getByText("אלון ברק").filter({ visible: true }).first()).toBeVisible();

    const list = await context.request.get("/api/admin/drivers?status=under_review");
    const { drivers } = (await list.json()) as { drivers: { user: { id: string; name: string } }[] };
    const pending = drivers.find((d) => d.user.name === "אלון ברק")!;
    const verify = await context.request.post(`/api/admin/drivers/${pending.user.id}/verify`, { data: { decision: "approve" } });
    expect(verify.status()).toBe(409);
    expect((await verify.json()).error.code).toBe("documents_missing");
  });

  test("a new ride appears in the rides list and the ride detail opens", async ({ page, context, browser }) => {
    const riderCtx = await browser.newContext();
    await loginViaApi(riderCtx, ACCOUNTS.rider);
    const ride = await createRideViaApi(riderCtx.request);
    await riderCtx.close();

    await loginViaApi(context, ACCOUNTS.admin);
    await page.goto("/admin/rides");
    await expect(page.getByRole("heading", { level: 1, name: "נסיעות" })).toBeVisible();
    await expect(page.getByText("דיזנגוף סנטר").filter({ visible: true }).first()).toBeVisible();
    await page.goto(`/admin/rides/${ride.id}`);
    await expect(page.getByText("כיכר רבין").filter({ visible: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("support staff see pricing read-only and cannot change the tariff", async ({ page, context }) => {
    await loginViaApi(context, ACCOUNTS.support);
    await page.goto("/admin/pricing");
    await expect(page.getByText("הרשאת מנהל").filter({ visible: true }).first()).toBeVisible();
    const res = await context.request.put("/api/admin/pricing", { data: { baseFareAgorot: 1300 } });
    expect(res.status()).toBe(403);
  });
});
