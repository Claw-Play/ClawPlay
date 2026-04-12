import { test, expect } from "@playwright/test";

test.describe("Skill detail page", () => {
  async function goToSkillDetail(page: any) {
    // Click any skill card from the skills listing
    await page.goto("/skills");
    await page.waitForLoadState("networkidle");
    const skillLink = page.locator("a[href^='/skills/']").first();
    const href = await skillLink.getAttribute("href");
    await page.goto(href!);
    await expect(page).toHaveURL(/\/skills\/.+/, { timeout: 10_000 });
  }

  test("skill detail page loads with breadcrumb and install card", async ({ page }) => {
    await goToSkillDetail(page);

    // Breadcrumb: "技能库" (zh) or "Skills" (en)
    await expect(page.getByText(/技能库|Skills/i).first()).toBeVisible();
    // Install card with command visible
    await expect(page.getByText(/clawplay install/i)).toBeVisible();
    // Reviews section present
    await expect(page.getByText(/评价|Reviews/i).first()).toBeVisible();
  });

  test("reviews section shows login prompt when unauthenticated", async ({ page }) => {
    await goToSkillDetail(page);

    // Reviews section: unauthenticated users see a login prompt
    // zh: "登录后可发表评价" or en: "Sign in to leave a review"
    const loginPrompt = page.getByText(/登录后|Sign in/i);
    await expect(loginPrompt).toBeVisible({ timeout: 10_000 });

    // There should be a link to login
    await expect(page.getByRole("link", { name: /登录|Sign In/i })).toBeVisible();
  });

  test("skill detail shows install command and quick install card", async ({ page }) => {
    await goToSkillDetail(page);

    // Quick install card visible
    await expect(page.getByText(/clawplay install/i)).toBeVisible();
    // Copy button visible ("复制" in zh, "Copy" in en)
    await expect(page.getByRole("button", { name: /复制|copy/i })).toBeVisible();
  });

  test("unauthenticated user cannot see review form", async ({ page }) => {
    await goToSkillDetail(page);

    // Form should not be present (only login prompt)
    // The "你的评分" heading should not be visible for unauthenticated users
    const formHeading = page.getByText(/你的评分|Your rating/i);
    await expect(formHeading).not.toBeVisible();
  });
});
