import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test.describe("Login form validation", () => {
  test("account tab is active by default — email + password form visible", async ({ page }) => {
    await page.goto("/login");
    // Default tab is account (email) — no need to switch
    await expect(page.getByLabel("邮箱")).toBeVisible();
    await expect(page.getByLabel("密码")).toBeVisible();
  });

  test("switching to phone tab shows phone form", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "手机号" }).click();
    await expect(page.getByLabel("手机号")).toBeVisible();
  });

  test("invalid email format → API returns error", async ({ page }) => {
    const res = await page.request.post("/api/auth/login", {
      data: { email: "not-an-email", password: "password123" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.toLowerCase()).toMatch(/invalid|email|password/i);
  });

  test("wrong password → error message shown, stays on /login", async ({ page }) => {
    const email = `wrongpw_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
    await registerUser(page.request, email, "correctpass123", "WrongPW");
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.getByLabel("密码").fill("wrongpassword");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(
      page.getByText(/invalid|incorrect|密码错误/i).first(), { timeout: 10_000 }
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("loading state — login button disabled during API call", async ({ page }) => {
    await page.goto("/login");
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
    await page.getByRole("button", { name: "手机号" }).click();
    await page.getByLabel("手机号").fill("12345");
    await page.getByRole("button", { name: "获取验证码" }).click();
    await expect(page.getByText(/有效的手机号/)).toBeVisible();
  });

  test("phone tab — countdown starts after sending code", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "手机号" }).click();
    await page.route("**/api/auth/sms/send", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ message: "验证码已发送" }) });
    });
    await page.getByLabel("手机号").fill("13800138000");
    await page.getByRole("button", { name: "获取验证码" }).click();
    await expect(page.getByRole("button", { name: /\d+s/ })).toBeVisible({ timeout: 2_000 });
  });

  test("wechat tab — shows wechat login link", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "微信" }).click();
    const wechatLink = page.getByRole("link", { name: /微信一键登录/i });
    await expect(wechatLink).toBeVisible();
    const href = await wechatLink.getAttribute("href");
    expect(href).toContain("/api/auth/wechat");
  });
});
