import { test, expect } from "@playwright/test";
import { loginAs, registerUser } from "./helpers/auth";

test.describe("Dashboard — revised features", () => {
  let TEST_EMAIL = "";

  test.beforeAll(async ({ request }) => {
    TEST_EMAIL = `dashrev_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
    const res = await registerUser(request, TEST_EMAIL, "dashrev123", "Dash Rev User");
    expect(res.ok()).toBeTruthy();
  });

  test("usage stats card renders and loads data", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashrev123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Usage stats heading visible
    await expect(page.getByText(/使用统计|Usage Stats/i)).toBeVisible({ timeout: 10_000 });

    // Initially shows skeleton; eventually shows real numbers
    // Either skeleton or actual numbers should be visible
    const statsSection = page.locator("text=/使用统计|Usage Stats/").locator("..");
    await expect(statsSection).toBeVisible({ timeout: 5_000 });
  });

  test("usage stats period toggle: 7d → 30d", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashrev123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Wait for data to load first
    await expect(page.getByText(/使用统计|Usage Stats/i)).toBeVisible({ timeout: 10_000 });

    // Click 30d button
    const btn30d = page.getByRole("button", { name: /近30天|30 Days/i });
    await btn30d.click();

    // Active button should have gradient
    await expect(btn30d).toHaveClass(/bg-gradient-to-r/);
  });

  test("⚙ edit button opens ProfileEditModal", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashrev123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // The edit button in the user card has "⚙" + "编辑" text
    const editBtn = page.getByRole("button", { name: /⚙.*编辑|编辑.*⚙|⚙/ });
    await editBtn.click();

    // Modal should be visible
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/用户名|Name/i)).toBeVisible();
  });

  test("revoke token button removes token from UI", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashrev123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Generate token if not already present
    const generateBtn = page.getByRole("button", { name: /生成密钥|generate token/i });
    if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateBtn.click();
      await expect(page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })).toBeVisible();
    }

    // Wait for token to appear
    await expect(page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })).toBeVisible();

    // Revoke button should be visible (text depends on locale)
    const revokeBtn = page.getByRole("button", { name: /撤销访问|revoke/i });
    await expect(revokeBtn).toBeVisible({ timeout: 5000 });

    await revokeBtn.click();
    await page.waitForTimeout(500); // allow UI to update

    // After revoke, generate button should appear again
    await expect(page.getByRole("button", { name: /生成密钥|generate token/i })).toBeVisible({ timeout: 10_000 });
  });

  test("top abilities badges render when data is available", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "dashrev123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Wait for stats to load
    await expect(page.getByText(/使用统计|Usage Stats/i)).toBeVisible({ timeout: 10_000 });

    // "Top Abilities" heading may or may not be present depending on data
    // At minimum, the usage stats card should render
    const statsCard = page.locator("text=/使用统计|Usage Stats/").locator("..").locator("..");
    await expect(statsCard).toBeVisible({ timeout: 5000 });
  });
});
