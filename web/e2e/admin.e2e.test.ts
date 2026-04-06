import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import { cleanupE2EData } from "../lib/__tests__/helpers/cleanup";

// NOTE: email values are set in beforeAll (per worker process), not at module load
const ADMIN_PASSWORD = "adminpass123";
const USER_PASSWORD = "userpass123";
const SAMPLE_SKILL_MD = `---
name: test-integration-skill
version: 1.0.0
---
# Test Integration Skill
A skill submitted during E2E testing.
`;

/** Promote a user to admin via direct DB script */
function makeAdmin(email: string) {
  const scriptPath = path.join(__dirname, "..", "scripts", "make-admin.js");
  execSync(`node "${scriptPath}" "${email}"`, { cwd: path.join(__dirname, "..") });
}

// Per-worker variables set in beforeAll
let ADMIN_EMAIL = "";
let USER_EMAIL = "";
let APPROVE_SKILL_NAME = "";
let REJECT_SKILL_NAME = "";

test.describe("Admin moderation flow", () => {
  test.beforeAll(async ({ request }) => {
    cleanupE2EData();
    const ts = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    ADMIN_EMAIL = `admin_${ts}_${suffix}@example.com`;
    USER_EMAIL = `user_${ts}_${suffix}@example.com`;
    APPROVE_SKILL_NAME = `E2E Approve ${ts}_${suffix}`;
    REJECT_SKILL_NAME = `E2E Reject ${ts}_${suffix}`;

    // Register admin user
    const adminRes = await request.post("/api/auth/register", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: "Admin User" },
    });
    expect(adminRes.ok(), `admin registration failed: ${(await adminRes.json()).error}`).toBeTruthy();
    makeAdmin(ADMIN_EMAIL.toLowerCase());

    // Register regular user
    const userRes = await request.post("/api/auth/register", {
      data: { email: USER_EMAIL, password: USER_PASSWORD, name: "Regular User" },
    });
    expect(userRes.ok(), `user registration failed: ${(await userRes.json()).error}`).toBeTruthy();
  });

  test("regular user is redirected away from /admin", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USER_EMAIL);
    await page.getByLabel("Password").fill(USER_PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/admin");
    // Client-side role check redirects non-admin away
    await expect(page).toHaveURL(/\/$|\/dashboard/, { timeout: 10_000 });
  });

  test("admin approves a skill → appears in public /skills list", async ({ page }) => {
    // Submit skill as regular user
    await page.goto("/login");
    await page.getByLabel("Email").fill(USER_EMAIL);
    await page.getByLabel("Password").fill(USER_PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/submit");
    await page.getByLabel("Skill name").fill(APPROVE_SKILL_NAME);
    await page.getByLabel("SKILL.md content").fill(SAMPLE_SKILL_MD);
    await page.getByRole("button", { name: /submit for review/i }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Login as admin
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /review queue/i })).toBeVisible({ timeout: 10_000 });

    // Click the Approve button for our skill card
    const skillCard = page.getByRole("heading", { name: APPROVE_SKILL_NAME }).locator("..").locator("..").locator("..");
    await skillCard.getByRole("button", { name: /approve/i }).click();
    await expect(page.getByText(APPROVE_SKILL_NAME)).not.toBeVisible({ timeout: 10_000 });

    // Audit log shows approve action
    await page.getByRole("button", { name: /audit log/i }).click();
    await expect(page.getByText(/approved skill/i)).toBeVisible({ timeout: 5_000 });

    // Approved skill now appears in public /skills
    await page.goto("/skills");
    await expect(page.getByText(APPROVE_SKILL_NAME)).toBeVisible({ timeout: 5_000 });
  });

  test("admin rejects a skill with reason", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // Submit a skill to reject
    await page.goto("/submit");
    await page.getByLabel("Skill name").fill(REJECT_SKILL_NAME);
    await page.getByLabel("SKILL.md content").fill(SAMPLE_SKILL_MD);
    await page.getByRole("button", { name: /submit for review/i }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/admin");
    await expect(page.getByText(REJECT_SKILL_NAME)).toBeVisible({ timeout: 5_000 });

    // Click Reject on our skill card
    const rejectCard = page.getByRole("heading", { name: REJECT_SKILL_NAME }).locator("..").locator("..").locator("..");
    await rejectCard.getByRole("button", { name: /reject/i }).click();
    await page.getByPlaceholder(/reason for rejection/i).fill("E2E test rejection reason");
    await page.getByRole("button", { name: /confirm reject/i }).click();

    await expect(page.getByText(REJECT_SKILL_NAME)).not.toBeVisible({ timeout: 10_000 });

    // Audit log shows reject + reason
    await page.getByRole("button", { name: /audit log/i }).click();
    await expect(page.getByText(/rejected skill/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/E2E test rejection reason/i).first()).toBeVisible({ timeout: 3_000 });
  });

  test("approved skill does not appear in admin review queue", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /review queue/i })).toBeVisible({ timeout: 10_000 });

    // The previously approved skill should not be in the queue
    const queueText = page.locator("body");
    await expect(queueText).not.toHaveText(new RegExp(APPROVE_SKILL_NAME), { timeout: 5_000 });
  });
});
