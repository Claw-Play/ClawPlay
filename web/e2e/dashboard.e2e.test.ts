import { test, expect } from "@playwright/test";
import { loginAs, registerUser } from "./helpers/auth";

test.describe("Dashboard", () => {
  let TEST_EMAIL = "";

  test.beforeAll(async ({ request }) => {
    TEST_EMAIL = `dash_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
    const res = await registerUser(request, TEST_EMAIL, "dashpass123", "Dashboard User");
    expect(res.ok()).toBeTruthy();
  });

  test("unauthenticated → redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("authenticated → shows user identity card with email", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
    // Identity card — email displayed
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test("quota progress bar renders", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /免费 Token|free quota/i })).toBeVisible();
    // Progress bar
    const bar = page.locator(".rounded-full").filter({ has: page.locator(".rounded-full") });
    await expect(bar.first()).toBeVisible();
    await expect(page.getByText(/remaining|剩余/i)).toBeVisible();
  });

  test("Generate Token button calls API and reveals token card", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.getByRole("button", { name: /生成密钥|generate token/i }).click();
    await expect(
      page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /复制|copy/i })).toBeVisible();
  });

  test("Copy button on token card shows Copied feedback", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await page.getByRole("button", { name: /生成密钥|generate token/i }).click();
    // Wait for token to appear (API may be slow)
    await expect(
      page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })
    ).toBeVisible();

    const copyBtn = page.getByRole("button", { name: /复制|copy/i });
    await copyBtn.click();
    await expect(page.getByRole("button", { name: /已复制|copied/i })).toBeVisible();
  });

  test("CLI guide section renders in token card area", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
    // CLI guide commands visible inside the card
    await expect(page.getByText(/npm install -g clawplay/i)).toBeVisible();
    await expect(page.getByText(/clawplay whoami/i)).toBeVisible();
  });

  test("⚙ edit button opens ProfileEditModal", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    const editBtn = page.getByRole("button", { name: /⚙.*编辑|编辑.*⚙|⚙/ });
    await editBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
  });

  test("Revoke token button visible after generating token", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.getByRole("button", { name: /生成密钥|generate token/i }).click();
    await expect(page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })).toBeVisible();

    await expect(page.getByRole("button", { name: /撤销|revoke/i })).toBeVisible({ timeout: 5000 });
  });
});
