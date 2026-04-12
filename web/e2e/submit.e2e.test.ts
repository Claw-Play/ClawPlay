import { test, expect } from "@playwright/test";
import { cleanupE2EData } from "../lib/__tests__/helpers/cleanup";

// Generated at runtime in beforeAll per worker
let TEST_EMAIL = "";
const TEST_PASSWORD = "submitpass123";

const SAMPLE_SKILL_MD = `---
name: submit-test-skill
version: 1.0.0
---
# Submit Test Skill
A skill for E2E submit flow testing.
`;

test.describe("Skill submission flow", () => {
  test.beforeAll(async ({ request }) => {
    cleanupE2EData();
    const ts = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    TEST_EMAIL = `submit_${ts}_${suffix}@example.com`;

    const res = await request.post("/api/auth/register", {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD, name: "Submit Tester" },
    });
    expect(res.ok(), `register failed: ${(await res.json()).error}`).toBeTruthy();
  });

  test("unauthenticated → redirected to /login", async ({ page }) => {
    await page.goto("/submit");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("authenticated → can submit skill → redirected to /dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /账号|account/i }).click();
    await page.getByLabel(/邮箱|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/密码|password/i).fill(TEST_PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/submit");
    await expect(page.getByLabel(/Skill.*名称|skill name/i)).toBeVisible({ timeout: 5_000 });

    await page.getByLabel(/Skill.*名称|skill name/i).fill("Submit Flow Skill");
    await page.getByLabel(/简介|summary/i).fill("Testing the submit flow");
    await page.getByLabel(/SKILL.md 内容|SKILL.md content/i).fill(SAMPLE_SKILL_MD);

    await page.getByRole("button", { name: /提交审核|submit for review/i }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
  });

  test("form validation — browser blocks empty required fields", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /账号|account/i }).click();
    await page.getByLabel(/邮箱|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/密码|password/i).fill(TEST_PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/submit");
    // SKILL.md is required — browser prevents form submission if empty
    await page.getByLabel(/SKILL.md 内容|SKILL.md content/i).fill(SAMPLE_SKILL_MD);
    // Name is required — click submit without name
    await page.getByRole("button", { name: /提交审核|submit for review/i }).click({ force: true });
    // Browser native validation keeps user on the form
    await expect(page).toHaveURL(/\/submit/, { timeout: 3_000 });
    const nameInput = page.getByLabel(/Skill.*名称|skill name/i);
    await expect(nameInput).toBeVisible();
  });
});
