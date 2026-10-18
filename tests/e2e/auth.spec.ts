import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoHorizontalOverflow, expectRtl, loginViaApi, uniqueEmail } from "./helpers";

test.describe("authentication & role routing", () => {
  test("landing page renders in Hebrew RTL with demo banner and CTAs", async ({ page }) => {
    await page.goto("/");
    await expectRtl(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("העיר שלך");
    await expect(page.getByText("סביבת הדגמה").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /להזמין נסיעה/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("anonymous users are redirected from app routes to login", async ({ page }) => {
    await page.goto("/ride");
    await expect(page).toHaveURL(/\/login\?next=%2Fride/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("signup as rider via the form lands in the rider app", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("שם מלא").fill("בדיקה אוטומטית");
    await page.getByLabel("אימייל").fill(uniqueEmail("rider"));
    await page.getByLabel("טלפון נייד").fill("0521234567");
    await page.getByLabel("סיסמה").fill("Test1234!");
    await page.getByRole("checkbox").check();
    await page.getByTestId("signup-submit").click();
    await expect(page).toHaveURL(/\/ride/, { timeout: 20_000 });
  });

  test("signup rejects a weak password and a bad phone with Hebrew errors", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("שם מלא").fill("בדיקה");
    await page.getByLabel("אימייל").fill(uniqueEmail("weak"));
    await page.getByLabel("טלפון נייד").fill("123");
    await page.getByLabel("סיסמה").fill("abcdefgh");
    await page.getByRole("checkbox").check();
    await page.getByTestId("signup-submit").click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("login with wrong password shows an error; correct login routes by role", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("אימייל").fill(ACCOUNTS.rider.email);
    await page.getByLabel("סיסמה").fill("wrong-password");
    await page.getByTestId("login-submit").click();
    await expect(page.getByRole("alert")).toContainText("שגויים");

    await page.getByLabel("סיסמה").fill(ACCOUNTS.rider.password);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/ride/, { timeout: 20_000 });
  });

  test("a rider cannot open the admin or driver apps", async ({ page, context }) => {
    await loginViaApi(context, ACCOUNTS.rider);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/ride/);
    await page.goto("/drive");
    await expect(page).toHaveURL(/\/ride/);
  });

  test("support and admin land on the dashboard; driver lands on the driver app", async ({ page, context }) => {
    await loginViaApi(context, ACCOUNTS.support);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await context.request.post("/api/auth/logout");

    await loginViaApi(context, ACCOUNTS.driver);
    await page.goto("/drive");
    await expect(page).toHaveURL(/\/drive/);
  });

  test("API refuses cross-role access", async ({ context }) => {
    await loginViaApi(context, ACCOUNTS.rider);
    const admin = await context.request.get("/api/admin/overview");
    expect(admin.status()).toBe(403);
    const driver = await context.request.get("/api/driver/profile");
    expect(driver.status()).toBe(403);
    await context.request.post("/api/auth/logout");
    const anon = await context.request.get("/api/rides/active");
    expect(anon.status()).toBe(401);
  });
});
