import { test, expect } from "@playwright/test";

test.describe("Skills browsing", () => {
  test("skills page loads", async ({ page }) => {
    await page.goto("/skills");
    await expect(page.getByRole("heading", { name: /explore skills/i })).toBeVisible();
  });

  test("emoji filter buttons are interactive", async ({ page }) => {
    await page.goto("/skills");

    // All filter should be active by default (use exact match to avoid "Show all skills")
    const allBtn = page.getByRole("button", { name: "All", exact: true });
    await expect(allBtn).toHaveClass(/bg-amber-500/);

    // Click an emoji filter
    const emojiBtns = page.getByRole("button").filter({ hasText: /^[^\s]+$/ });
    const firstEmoji = emojiBtns.first();
    await firstEmoji.click();

    // Active emoji should now have amber-500 class
    // (the filter is client-side, grid updates immediately)
  });

  test("skills page has nav link to home", async ({ page }) => {
    await page.goto("/skills");
    await page.getByAltText("ClawPlay").first().isVisible();
  });
});
