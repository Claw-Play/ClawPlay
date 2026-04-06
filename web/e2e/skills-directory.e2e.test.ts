import { test, expect } from "@playwright/test";
import { loginAs, registerUser } from "./helpers/auth";

test.describe("Skills directory", () => {
  test("page heading and count render", async ({ page }) => {
    await page.goto("/skills");
    await expect(
      page.getByRole("heading", { name: /explore skills/i })
    ).toBeVisible();
  });

  test("emoji filter 'All' button is active by default", async ({ page }) => {
    await page.goto("/skills");
    const allBtn = page.getByRole("button", { name: "All", exact: true });
    await expect(allBtn).toBeVisible();
    await expect(allBtn).toHaveClass(/from-\[#a23f00\]/);
  });

  test("clicking emoji filter button activates it", async ({ page }) => {
    await page.goto("/skills");
    const filterBtns = page.getByRole("button").filter({ hasNotText: "All" });
    const emojiBtn = filterBtns.first();
    await emojiBtn.click();
    await expect(emojiBtn).toHaveClass(/from-\[#a23f00\]/);
  });

  test("clicking 'All' resets emoji filter", async ({ page }) => {
    await page.goto("/skills");
    const filterBtns = page.getByRole("button").filter({ hasNotText: "All" });
    await filterBtns.first().click();
    const allBtn = page.getByRole("button", { name: "All", exact: true });
    await allBtn.click();
    await expect(allBtn).toHaveClass(/from-\[#a23f00\]/);
  });

  test("search bar filters skills by name", async ({ page }) => {
    await page.goto("/skills");
    const searchInput = page.getByPlaceholder(/search skills/i);
    await searchInput.fill("xyzabc123nonexistent");
    // Empty state should show "no results"
    await expect(page.getByText(/no results for/i)).toBeVisible();
    // Reset
    const resetBtn = page.getByRole("button", { name: /show all skills/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await expect(searchInput).toHaveValue("");
  });

  test("empty state shows with 'Show all skills' button", async ({ page }) => {
    await page.goto("/skills");
    const searchInput = page.getByPlaceholder(/search skills/i);
    await searchInput.fill("xyzabc123nonexistent");
    await expect(page.getByText(/no results for/i)).toBeVisible();
    const resetBtn = page.getByRole("button", { name: /show all skills/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await expect(page.getByPlaceholder(/search skills/i)).toHaveValue("");
  });

  test("skill cards link to individual skill detail pages", async ({ page }) => {
    await page.goto("/skills");
    const firstCard = page.locator("a[href^='/skills/']").first();
    const href = await firstCard.getAttribute("href");
    expect(href).toMatch(/^\/skills\/.+/);
  });

  test("authenticated: Submit a Skill button is visible", async ({ page }) => {
    const email = `skills_${Date.now()}@example.com`;
    await registerUser(page.request, email, "testpass123", "Skills User");
    await loginAs(page, email, "testpass123");
    await page.goto("/skills");
    await expect(page.getByRole("link", { name: /submit a skill/i })).toBeVisible();
  });
});
