import { test, expect } from "@playwright/test";
import { loginAs, registerUser } from "./helpers/auth";

test.describe("Token lifecycle", () => {
  let TEST_EMAIL = "";

  test.beforeAll(async ({ request }) => {
    TEST_EMAIL = `token_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
    const res = await registerUser(request, TEST_EMAIL, "tokenpass123", "Token User");
    expect(res.ok()).toBeTruthy();
  });

  test("generate token → copy button visible", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "tokenpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Click generate
    const generateBtn = page.getByRole("button", { name: /生成密钥|generate token/i });
    await generateBtn.click();
    await expect(page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })).toBeVisible();

    // Copy button visible
    await expect(page.getByRole("button", { name: /复制|copy/i })).toBeVisible();
  });

  test("copy token → shows Copied feedback", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "tokenpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    const generateBtn = page.getByRole("button", { name: /生成密钥|generate token/i });
    if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateBtn.click();
    }
    await expect(page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })).toBeVisible();

    const copyBtn = page.getByRole("button", { name: /复制|copy/i });
    await copyBtn.click();
    // Copied feedback should appear
    await expect(page.getByRole("button", { name: /已复制|copied/i })).toBeVisible({ timeout: 3000 });
  });

  test("revoke token → generate button reappears", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "tokenpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Ensure token exists
    const generateBtn = page.getByRole("button", { name: /生成密钥|generate token/i });
    if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateBtn.click();
    }
    await expect(page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })).toBeVisible();

    // Revoke
    const revokeBtn = page.getByRole("button", { name: /撤销访问|revoke/i });
    await revokeBtn.click();
    await page.waitForTimeout(500);

    // Generate button should come back
    await expect(page.getByRole("button", { name: /生成密钥|generate token/i })).toBeVisible({ timeout: 10_000 });
  });

  test("generate token → localStorage stores the token", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "tokenpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Generate token
    const generateBtn = page.getByRole("button", { name: /生成密钥|generate token/i });
    if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateBtn.click();
    }
    await expect(page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })).toBeVisible();

    // Check localStorage
    const stored = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("clawplay_token_"));
      return keys.length > 0;
    });
    expect(stored).toBeTruthy();
  });

  test("page reload → token restored from localStorage", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "tokenpass123");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Generate token first
    const generateBtn = page.getByRole("button", { name: /生成密钥|generate token/i });
    if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateBtn.click();
    }
    await expect(page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 30_000 })).toBeVisible();

    // Reload page
    await page.reload();
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Token should still be visible (restored from localStorage)
    await expect(page.getByText(/export CLAWPLAY_TOKEN=/i, { timeout: 10_000 })).toBeVisible();
  });
});
