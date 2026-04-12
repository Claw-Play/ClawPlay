import { test, expect } from "@playwright/test";

const TEST_EMAIL = `testuser_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
const TEST_PASSWORD = "testpassword123";

test.describe("Auth flow", () => {
  test("register via API → login via UI → dashboard → logout", async ({ page }) => {
    // Register via API (UI has no email tab — uses phone/SMS)
    const res = await page.request.post("/api/auth/register", {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD, name: "Test User" },
    });
    expect(res.status()).toBe(201);

    // Login via UI — click 账号 tab, fill account form
    await page.goto("/login");
    await page.getByRole("button", { name: /账号|account/i }).click();
    await page.getByLabel(/邮箱|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/密码|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /登录|login/i }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });

    // Dashboard user card visible
    await expect(page.getByText(/欢迎回来|welcome/i, { exact: false })).toBeVisible({ timeout: 15_000 });

    // Generate token first (sign-out button lives inside the token card)
    await page.getByRole("button", { name: /generate token/i }).click();
    await expect(
      page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })
    ).toBeVisible();

    // Logout
    await page.getByText(/退出|logout|sign out/i).click();
    await expect(page).toHaveURL("/", { timeout: 5_000 });
  });

  test("login with valid email credentials", async ({ page }) => {
    // Register
    const res = await page.request.post("/api/auth/register", {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD, name: "Test User" },
    });
    expect(res.status()).toBe(201);

    // Login via UI
    await page.goto("/login");
    await page.getByRole("button", { name: /账号|account/i }).click();
    await page.getByLabel(/邮箱|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/密码|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /登录|login/i }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });

    // Generate token first (sign-out button lives inside the token card)
    await page.getByRole("button", { name: /generate token/i }).click();
    await expect(
      page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })
    ).toBeVisible();

    // Logout
    await page.getByText(/退出|logout|sign out/i).click();
    await expect(page).toHaveURL("/", { timeout: 5_000 });

    // Log back in
    await page.goto("/login");
    await page.getByRole("button", { name: /账号|account/i }).click();
    await page.getByLabel(/邮箱|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/密码|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /登录|login/i }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /账号|account/i }).click();
    await page.getByLabel(/邮箱|email/i).fill("wrong@example.com");
    await page.getByLabel(/密码|password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /登录|login/i }).click();
    await expect(
      page.getByText(/invalid email or password/i, { timeout: 15_000 })
    ).toBeVisible();
  });

  test("protected pages redirect to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await page.goto("/submit");
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });

  test("register via API — name is optional", async ({ page }) => {
    const email = `noname_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
    const res = await page.request.post("/api/auth/register", {
      data: { email, password: "password123" },
    });
    expect(res.status()).toBe(201);
  });

  test("login page — tab switcher visible with 手机号/微信/账号 tabs", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /手机号|phone/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /微信|wechat/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /账号|account/i })).toBeVisible();
  });

  test("phone tab — send code button visible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "获取验证码" })).toBeVisible();
  });

  test("wechat tab — wechat login button visible", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "微信" }).click();
    await expect(page.getByRole("link", { name: /微信一键登录/ })).toBeVisible();
  });
});
