import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

/** Switch to the email tab on the login page */
async function switchToEmailTab(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "邮箱" }).click();
}

test.describe("Login form validation", () => {
  test("phone tab is active by default", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "获取验证码" })).toBeVisible();
  });

  test("switching to email tab shows email/password form", async ({ page }) => {
    await page.goto("/login");
    await switchToEmailTab(page);
    await expect(page.getByLabel("邮箱")).toBeVisible();
    await expect(page.getByLabel("密码")).toBeVisible();
  });

  test("invalid email format shows error from API", async ({ page }) => {
    await page.goto("/login");
    await switchToEmailTab(page);
    await page.getByLabel("邮箱").fill("not-an-email");
    await page.getByLabel("密码").fill("password123");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(
      page.getByText(/invalid|incorrect|wrong|does not exist/i, { timeout: 10_000 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("wrong password shows error and stays on page", async ({ page }) => {
    const email = `wrongpw_${Date.now()}@example.com`;
    await registerUser(page.request, email, "correctpass123", "WrongPW");
    await page.goto("/login");
    await switchToEmailTab(page);
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill("wrongpassword");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(
      page.getByText(/invalid.*password|password.*invalid|incorrect/i, { timeout: 10_000 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("'注册' link navigates to /register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "注册" }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("loading state — email login button disabled during API call", async ({ page }) => {
    await page.goto("/login");
    await switchToEmailTab(page);
    await page.route("**/api/auth/login", async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.fulfill({ status: 401, body: JSON.stringify({ error: "test" }) });
    });
    await page.getByLabel("邮箱").fill("test@example.com");
    await page.getByLabel("密码").fill("pass123");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByRole("button", { name: "登录" })).toBeDisabled({ timeout: 500 });
  });

  test("phone tab — invalid phone number shows error", async ({ page }) => {
    await page.goto("/login");
    // Already on phone tab
    await page.getByLabel("手机号").fill("12345");
    await page.getByRole("button", { name: "获取验证码" }).click();
    await expect(page.getByText(/有效的手机号/)).toBeVisible();
  });

  test("phone tab — countdown starts after sending code to valid phone", async ({ page }) => {
    await page.goto("/login");
    // Intercept the SMS send API to avoid real HTTP call
    await page.route("**/api/auth/sms/send", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ message: "验证码已发送" }) });
    });
    await page.getByLabel("手机号").fill("13800138000");
    await page.getByRole("button", { name: "获取验证码" }).click();
    // Button should switch to countdown (e.g. "60s")
    await expect(page.getByRole("button", { name: /\d+s/ })).toBeVisible({ timeout: 2_000 });
  });

  test("wechat tab — shows wechat login link", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "微信" }).click();
    const wechatLink = page.getByRole("link", { name: /微信一键登录/ });
    await expect(wechatLink).toBeVisible();
    const href = await wechatLink.getAttribute("href");
    expect(href).toContain("/api/auth/wechat");
  });
});
