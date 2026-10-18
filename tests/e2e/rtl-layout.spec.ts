import { test } from "@playwright/test";
import { ACCOUNTS, expectNoHorizontalOverflow, expectRtl, loginViaApi } from "./helpers";

/**
 * Runs on every Playwright project (phone / tablet / desktop): each key page
 * must be RTL and must not overflow horizontally at that viewport.
 */
const PUBLIC_PAGES = ["/", "/login", "/signup?role=driver", "/legal/terms", "/legal/privacy"];

for (const path of PUBLIC_PAGES) {
  test(`public page ${path} is RTL without horizontal overflow`, async ({ page }) => {
    await page.goto(path);
    await expectRtl(page);
    await expectNoHorizontalOverflow(page);
  });
}

test("rider, driver and admin homes are RTL without horizontal overflow", async ({ page, context }) => {
  await loginViaApi(context, ACCOUNTS.rider);
  await page.goto("/ride");
  await page.waitForLoadState("networkidle");
  await expectRtl(page);
  await expectNoHorizontalOverflow(page);
  await context.request.post("/api/auth/logout");

  await loginViaApi(context, ACCOUNTS.driver);
  await page.goto("/drive");
  await page.waitForLoadState("networkidle");
  await expectRtl(page);
  await expectNoHorizontalOverflow(page);
  await context.request.post("/api/auth/logout");

  await loginViaApi(context, ACCOUNTS.admin);
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await expectRtl(page);
  await expectNoHorizontalOverflow(page);
});
