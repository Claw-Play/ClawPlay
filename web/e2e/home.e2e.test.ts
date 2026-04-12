import { test, expect } from "@playwright/test";
import { loginAs, registerUser } from "./helpers/auth";

test.describe("Home page", () => {
  test("hero section renders with headline, subtitle, and CTA buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/build the future/i)).toBeVisible();
    await expect(
      page.getByText(/community hub for x claw social/i).first()
    ).toBeVisible();
    const ctaBtn = page.getByRole("link", { name: /免费开始使用|start for free/i });
    await expect(ctaBtn).toBeVisible();
    await expect(ctaBtn).toHaveAttribute("href", "/login");
    await expect(page.getByRole("link", { name: /浏览.*技能|browse skills/i })).toBeVisible();
  });

  test("nav shows Sign in + Get started when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /登录|sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /免费开始使用|get started/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /控制台|dashboard/i })).not.toBeVisible();
  });

  test("nav shows Dashboard when authenticated", async ({ page }) => {
    const email = `home_nav_${Date.now()}@example.com`;
    await registerUser(page.request, email, "testpass123", "Nav Tester");
    await loginAs(page, email, "testpass123");
    await page.goto("/");
    await expect(page.getByRole("link", { name: /控制台|dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /登录|sign in/i })).not.toBeVisible();
  });

  test("featured skills section renders when skills exist", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: /热门 Skills|featured skills/i });
    await expect(heading).toBeVisible();
    await expect(page.getByRole("link", { name: /浏览.*技能|view all skills/i })).toBeVisible();
  });

  test("footer renders with all four columns and links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("About").first()).toBeVisible();
    await expect(page.getByText("Resources")).toBeVisible();
    await expect(page.getByText("Skill Authoring Guide")).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy"
    );
  });

  test("HomeClient copy button — copy-to-clipboard UI when authenticated", async ({
    page,
  }) => {
    const email = `home_copy_${Date.now()}@example.com`;
    await registerUser(page.request, email, "testpass123", "Copy Tester");
    await loginAs(page, email, "testpass123");

    await page.goto("/");
    await expect(page.getByText(/快速开始|one-click cli setup/i)).toBeVisible();
    const copyBtn = page.getByRole("button", { name: /复制|copy/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(page.getByRole("button", { name: /已复制|copied/i })).toBeVisible();
  });

  test("features section renders all 6 feature cards", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: /为什么选择 ClawPlay|why clawplay/i });
    await expect(heading).toBeVisible();
    // 6 feature cards — each has an emoji div
    const featuresSection = page.locator("section").filter({ hasText: /why clawplay/i });
    const emojis = featuresSection.locator("div.text-3xl");
    await expect(emojis).toHaveCount(6);
  });
});
