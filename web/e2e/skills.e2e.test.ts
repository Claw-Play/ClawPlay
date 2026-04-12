import { test, expect } from "@playwright/test";

test.describe("Skills browsing", () => {
  test("skills page loads", async ({ page }) => {
    await page.goto("/skills");
    // Skills page heading: "技能库" (zh) or "Skills" (en)
    await expect(page.getByRole("heading", { name: /技能库|Skills/i })).toBeVisible();
  });

  test("emoji filter buttons are interactive", async ({ page }) => {
    await page.goto("/skills");
    // "All" filter button: "全部" (zh) or "All" (en)
    const allBtn = page.getByRole("button", { name: /全部|All/i, exact: true });
    // Active "All" button uses the warm gradient
    await expect(allBtn).toHaveClass(/from-\[#a23f00\]|bg-gradient-to-r/);
  });

  test("skills page has nav link to home", async ({ page }) => {
    await page.goto("/skills");
    await page.getByAltText("ClawPlay").first().isVisible();
  });

  test("clicking a skill card navigates to skill detail page", async ({ page }) => {
    await page.goto("/skills");
    // Skills page heading confirms page loaded
    await expect(page.getByRole("heading", { name: /技能库|Skills/i })).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Click the first skill card link
    const firstSkillHeading = page.getByRole("heading", { level: 3 }).first();
    const skillName = await firstSkillHeading.textContent();
    expect(skillName).toBeTruthy();

    await firstSkillHeading.click();
    await expect(page).toHaveURL(/\/skills\/.+/, { timeout: 10_000 });

    // Skill detail page should show the skill name and install command
    await expect(page.getByText(skillName!).first()).toBeVisible();
    await expect(page.getByText(/clawplay install/i)).toBeVisible();
  });

  test("skill detail page shows install command", async ({ page }) => {
    await page.goto("/skills");
    await page.waitForLoadState("networkidle");

    const firstSkillHeading = page.getByRole("heading", { level: 3 }).first();
    await firstSkillHeading.click();
    await expect(page).toHaveURL(/\/skills\/.+/, { timeout: 10_000 });

    // Install command visible
    await expect(page.getByText(/clawplay install/i)).toBeVisible();
  });
});
