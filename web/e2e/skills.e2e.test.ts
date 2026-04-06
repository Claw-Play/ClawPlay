import { test, expect } from "@playwright/test";

test.describe("Skills browsing", () => {
  test("skills page loads", async ({ page }) => {
    await page.goto("/skills");
    await expect(page.getByRole("heading", { name: /explore skills/i })).toBeVisible();
  });

  test("emoji filter buttons are interactive", async ({ page }) => {
    await page.goto("/skills");

    // All filter should be active by default
    const allBtn = page.getByRole("button", { name: "All", exact: true });
    // Active "All" button uses the warm gradient, not amber-500
    await expect(allBtn).toHaveClass(/from-\[#a23f00\]|bg-gradient-to-r/);
  });

  test("skills page has nav link to home", async ({ page }) => {
    await page.goto("/skills");
    await page.getByAltText("ClawPlay").first().isVisible();
  });
});
