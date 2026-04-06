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
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText("Submit Skill")).toBeVisible();
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

    await page.getByLabel("Skill name").fill("Form Validation Skill");
    await page.getByLabel("One-line summary").fill("Testing validation");
    // SKILL.md is empty (required) — submit should stay on page
    await page.getByRole("button", { name: /submit for review/i }).click({ force: true });
    await expect(page).toHaveURL(/\/submit/);
  });

  test("form: success redirect to /dashboard after submission", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");

    await page.getByLabel("Skill name").fill("Form Success Skill");
    await page.getByLabel("One-line summary").fill("Testing success flow");
    await page.getByLabel("SKILL.md content").fill(SAMPLE_SKILL_MD);
    await page.getByRole("button", { name: /submit for review/i }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
  });

  test("'How it works' sidebar guide renders steps", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");
    await expect(
      page.getByRole("heading", { name: /how it works/i })
    ).toBeVisible();
    await expect(page.getByText(/fill in the form|step 1/i)).toBeVisible();
  });

  test("SKILL.md template sidebar renders frontmatter example", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, "submitpass123");
    await page.goto("/submit");
    await expect(
      page.getByRole("heading", { name: /skill\.md template/i })
    ).toBeVisible();
    await expect(page.getByText(/name: my skill/i)).toBeVisible();
  });
});
