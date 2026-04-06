import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

/** Switch to the email tab on the register page */
async function switchToEmailTab(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "邮箱" }).click();
}

test.describe("Register form validation", () => {
  test("phone tab is active by default on register page", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("button", { name: "获取验证码" })).toBeVisible();
  });

  test("password mismatch shows inline error and stays on page", async ({ page }) => {
    await page.goto("/register");
    await switchToEmailTab(page);
    await page.getByLabel("昵称").fill("Test User");
    await page.getByLabel("邮箱").fill(`mismatch_${Date.now()}@example.com`);
    await page.getByLabel("密码").fill("password123");
    await page.getByLabel("确认密码").fill("differentpassword");
    await page.getByRole("button", { name: "创建账号" }).click();
    await expect(
      page.getByText(/两次密码不一致/i, { timeout: 5_000 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("password shorter than 8 chars shows inline error", async ({ page }) => {
    await page.goto("/register");
    await switchToEmailTab(page);
    await page.getByLabel("昵称").fill("Short PW");
    await page.getByLabel("邮箱").fill(`shortpw_${Date.now()}@example.com`);
    await page.getByLabel("密码").fill("short");
    await page.getByLabel("确认密码").fill("short");
    await page.getByRole("button", { name: "创建账号" }).click();
    await expect(
      page.getByText(/密码至少8位/i, { timeout: 5_000 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("successful email registration redirects to /dashboard", async ({ page }) => {
    const email = `success_${Date.now()}@example.com`;
    await page.goto("/register");
    await switchToEmailTab(page);
    await page.getByLabel("昵称").fill("Success User");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill("password123");
    await page.getByLabel("确认密码").fill("password123");
    await page.getByRole("button", { name: "创建账号" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });
  });

  test("duplicate email shows API error banner", async ({ page }) => {
    const dupEmail = `dup_${Date.now()}@example.com`;
    await registerUser(page.request, dupEmail, "password123", "Dup");
    await page.goto("/register");
    await switchToEmailTab(page);
    await page.getByLabel("昵称").fill("Dup User");
    await page.getByLabel("邮箱").fill(dupEmail);
    await page.getByLabel("密码").fill("password123");
    await page.getByLabel("确认密码").fill("password123");
    await page.getByRole("button", { name: "创建账号" }).click();
    await expect(
      page.getByText(/already exists|already registered/i, { timeout: 10_000 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("'登录' link navigates to /login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("free tier badge is visible on registration page (email tab)", async ({ page }) => {
    await page.goto("/register");
    await switchToEmailTab(page);
    await expect(page.getByText(/1,000 配额/i)).toBeVisible();
  });

  test("free tier badge is visible on phone tab", async ({ page }) => {
    await page.goto("/register");
    // Phone tab is default
    await expect(page.getByText(/1,000 配额/i)).toBeVisible();
  });

  test("phone tab — invalid phone shows error when requesting code", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("手机号").fill("12345");
    await page.getByRole("button", { name: "获取验证码" }).click();
    await expect(page.getByText(/有效的手机号/)).toBeVisible();
  });

  test("wechat tab — shows wechat register/login link", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "微信" }).click();
    const wechatLink = page.getByRole("link", { name: /微信一键注册/ });
    await expect(wechatLink).toBeVisible();
    const href = await wechatLink.getAttribute("href");
    expect(href).toContain("/api/auth/wechat");
  });
});
