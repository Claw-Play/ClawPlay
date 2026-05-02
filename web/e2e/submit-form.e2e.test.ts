import { test, expect } from "@playwright/test";
import { loginAs, registerUser } from "./helpers/auth";

const SAMPLE_SKILL_MD = `---
name: e2e-form-skill
version: 1.0.0
---
# E2E Form Skill
Testing form validation.
`;

test.describe("Submit skill page", () => {
  let TEST_EMAIL = "";

  test.beforeAll(async ({ request }) => {
    TEST_EMAIL = `submit_form_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
    const res = await registerUser(request, TEST_EMAIL, "submitpass123", "Form Tester");
    expect(res.ok()).toBeTruthy();
  });

  test("auth guard — unauthenticated redirects to /login", async ({ page }) => {
    await page.goto("/submit");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("breadcrumb: Dashboard > Submit Skill", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");
    await expect(page.getByText(/控制台|dashboard/i)).toBeVisible();
    await expect(page.getByText(/提交 Skill|submit skill/i)).toBeVisible();
  });

  test("emoji picker selection updates selected emoji styling", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");

    // Default emoji is 🦐 — click 🎵
    const emojiBtn = page.getByRole("button", { name: "🎵" });
    await emojiBtn.click();
    // Selected emoji has ring-2 and border
    await expect(emojiBtn).toHaveClass(/ring-2/);
  });

  test("form: SKILL.md required — cannot submit without it", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");

    await page.getByLabel(/Skill.*名称|skill name/i).fill("Form Validation Skill");
    await page.getByLabel(/简介|summary/i).fill("Testing validation");
    // SKILL.md is empty (required) — submit should stay on page
    await page.getByRole("button", { name: /提交审核|submit for review/i }).click({ force: true });
    await expect(page).toHaveURL(/\/submit/);
  });

  test("form: success redirect to /dashboard after submission", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");

    await page.getByLabel(/Skill.*名称|skill name/i).fill("Form Success Skill");
    await page.getByLabel(/简介|summary/i).fill("Testing success flow");
    await page.getByLabel(/SKILL.md 内容|SKILL.md content/i).fill(SAMPLE_SKILL_MD);
    await page.getByRole("button", { name: /提交审核|submit for review/i }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
  });

  test("form: submitted draft is cleared when returning to /submit", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");

    await page.getByLabel(/Skill.*名称|skill name/i).fill("Draft Clear Skill");
    await page.getByLabel(/简介|summary/i).fill("Testing draft clearing");
    await page.getByLabel(/SKILL.md 内容|SKILL.md content/i).fill(SAMPLE_SKILL_MD);
    await page.getByRole("button", { name: /提交审核|submit for review/i }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/submit");
    await expect(page.locator("textarea")).toHaveCount(0);
  });

  test("'How it works' sidebar guide renders steps", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");
    await expect(
      page.getByRole("heading", { name: /工作原理|how it works/i })
    ).toBeVisible();
    await expect(page.getByText(/填写表单|fill in the form|step 1/i)).toBeVisible();
  });

  test("SKILL.md template sidebar renders frontmatter example", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");
    await expect(
      page.getByRole("heading", { name: /SKILL.md.*模板|skill\.md template/i })
    ).toBeVisible();
    await expect(page.getByText(/name: my skill/i)).toBeVisible();
  });
});
