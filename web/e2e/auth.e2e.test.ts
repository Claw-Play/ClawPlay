import { test, expect } from "@playwright/test";

const TEST_EMAIL = `testuser_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
const TEST_PASSWORD = "testpassword123";

/** Switch to the email tab on login/register pages */
async function switchToEmailTab(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "邮箱" }).click();
}

test.describe("Auth flow", () => {
  test("register (email tab) → login → dashboard → logout", async ({ page }) => {
    await page.goto("/register");
    await switchToEmailTab(page);

    await page.getByLabel("昵称").fill("Test User");
    await page.getByLabel("邮箱").fill(TEST_EMAIL);
    // Use exact: true — register page has both "密码" and "确认密码" fields
    await page.getByLabel("密码", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("确认密码").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "创建账号" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });
    await expect(page.getByText(/USR-/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /generate token/i })).toBeVisible();

    // Logout — dashboard shows "Revoke Access & Sign out"
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/", { timeout: 5_000 });
  });

  test("login with valid email credentials", async ({ page }) => {
    // Register first
    await page.goto("/register");
    await switchToEmailTab(page);
    await page.getByLabel("昵称").fill("Test User");
    await page.getByLabel("邮箱").fill(TEST_EMAIL);
    await page.getByLabel("密码", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("确认密码").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "创建账号" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/", { timeout: 5_000 });

    // Log back in
    await page.goto("/login");
    await switchToEmailTab(page);
    await page.getByLabel("邮箱").fill(TEST_EMAIL);
    await page.getByLabel("密码").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await switchToEmailTab(page);
    await page.getByLabel("邮箱").fill("wrong@example.com");
    await page.getByLabel("密码").fill("wrongpassword");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(
      page.getByText(/无效|错误|登录失败/i, { timeout: 15_000 })
    ).toBeVisible();
  });

  test("protected pages redirect to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await page.goto("/submit");
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });

  test("register with email — name is optional (API returns 201)", async ({ page }) => {
    const email = `noname_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
    const res = await page.request.post("/api/auth/register", {
      data: { email, password: "password123" },
    });
    expect(res.status()).toBe(201);
  });

  test("login page — tab switcher visible with 手机号/微信/邮箱 tabs", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "手机号" })).toBeVisible();
    await expect(page.getByRole("button", { name: "微信" })).toBeVisible();
    await expect(page.getByRole("button", { name: "邮箱" })).toBeVisible();
  });

  test("register page — tab switcher visible with 手机号/微信/邮箱 tabs", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("button", { name: "手机号" })).toBeVisible();
    await expect(page.getByRole("button", { name: "微信" })).toBeVisible();
    await expect(page.getByRole("button", { name: "邮箱" })).toBeVisible();
  });

  test("login page — branding panel visible on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await expect(page.getByText("欢迎回到 ClawPlay")).toBeVisible();
  });

  test("register page — branding panel visible on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/register");
    // "加入 ClawPlay 社区" appears in heading AND as page title — use first()
    await expect(page.getByText("加入 ClawPlay 社区").first()).toBeVisible();
  });

  test("phone tab — send code button visible after switching to 手机号", async ({ page }) => {
    await page.goto("/login");
    // Default tab is 手机号, so code send button should already be visible
    await expect(page.getByRole("button", { name: "获取验证码" })).toBeVisible();
  });

  test("wechat tab — wechat login button visible after switching to 微信", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "微信" }).click();
    await expect(page.getByRole("link", { name: /微信一键登录/ })).toBeVisible();
  });
});
