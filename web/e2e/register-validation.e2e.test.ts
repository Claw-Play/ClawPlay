import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test.describe("Register form validation", () => {
  test("phone tab is active by default on login/register page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "手机号" })).toBeVisible();
    // Phone input visible in default tab
    await expect(page.getByLabel("手机号")).toBeVisible();
  });

  test("phone tab — invalid phone number shows error when requesting code", async ({ page }) => {
    await page.goto("/login");
    // Already on phone tab (default)
    await page.getByLabel("手机号").fill("12345");
    await page.getByRole("button", { name: "获取验证码" }).click();
    await expect(page.getByText(/有效的手机号/)).toBeVisible();
  });

  test("phone tab — countdown starts after sending code (mocked)", async ({ page }) => {
    await page.goto("/login");
    // Mock the SMS send endpoint
    await page.route("**/api/auth/sms/send", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ message: "验证码已发送" }),
      });
    });
    await page.getByLabel("手机号").fill("13800138000");
    await page.getByRole("button", { name: "获取验证码" }).click();
    // Should show countdown like "59s"
    await expect(page.getByRole("button", { name: /\d+s/ })).toBeVisible({ timeout: 2_000 });
  });

  test("phone tab — test bypass code 000000 works for verification", async ({ page }) => {
    // Mock SMS send to capture the flow
    await page.route("**/api/auth/sms/send", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ message: "发送成功" }),
      });
    });

    await page.goto("/login");
    await page.getByLabel(/手机号|phone/i).fill("13800138000");
    await page.getByRole("button", { name: /获取验证码|send code/i }).click();
    // Fill test bypass code
    await page.getByPlaceholder(/6位验证码|verification code/i).fill("000000");
    await page.getByRole("button", { name: /^注册$/ }).click();
    // Should redirect to dashboard on success
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
  });

  test("wechat tab — shows wechat register/login link", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "微信" }).click();
    await expect(
      page.getByRole("link", { name: /微信一键注册|微信注册|微信登录/ })
    ).toBeVisible();
  });

  test("'登录' link navigates to /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("register via API — duplicate email shows error", async ({ page }) => {
    const dupEmail = `dup_${Date.now()}@example.com`;
    // First registration
    const res1 = await page.request.post("/api/auth/register", {
      data: { email: dupEmail, password: "password123" },
    });
    expect(res1.status()).toBe(201);

    // Duplicate registration
    const res2 = await page.request.post("/api/auth/register", {
      data: { email: dupEmail, password: "password456" },
    });
    expect(res2.status()).toBe(409);
    const body = await res2.json();
    expect(body.error.toLowerCase()).toMatch(/already|exists|duplicate/i);
  });

  test("register via API — name is optional", async ({ page }) => {
    const email = `noname_${Date.now()}@example.com`;
    const res = await page.request.post("/api/auth/register", {
      data: { email, password: "password123" },
    });
    expect(res.status()).toBe(201);
  });
});
