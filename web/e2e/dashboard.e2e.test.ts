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

  test("authenticated → shows user identity card with user ID", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
    // Identity card — user ID displayed (USR-#### format)
    await expect(page.getByText(/USR-/i)).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test("quota progress bar renders", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /free quota/i })).toBeVisible();
    // Progress bar
    const bar = page.locator(".rounded-full").filter({ has: page.locator(".rounded-full") });
    await expect(bar.first()).toBeVisible();
    await expect(page.getByText(/remaining/i)).toBeVisible();
  });

  test("Generate Token button calls API and reveals token card", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.getByRole("button", { name: /generate token/i }).click();
    await expect(
      page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /copy/i })).toBeVisible();
  });

  test("Copy button on token card shows Copied feedback", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await page.getByRole("button", { name: /generate token/i }).click();
    // Wait for token to appear (API may be slow)
    await expect(
      page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })
    ).toBeVisible();

    const copyBtn = page.getByRole("button", { name: /copy/i });
    await copyBtn.click();
    await expect(page.getByRole("button", { name: /copied/i })).toBeVisible();
  });

  test("Quick start section renders", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page.getByRole("heading", { name: /quick start/i })).toBeVisible();
    await expect(page.getByText(/install cli/i)).toBeVisible();
  });

  test("nav links: Browse Skills and Submit a Skill", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashpass123");
    await expect(page.getByRole("link", { name: /browse skills/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /submit a skill/i })).toBeVisible();
  });
});
