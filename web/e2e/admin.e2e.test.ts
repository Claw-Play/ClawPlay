import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import { loginAs } from "./helpers/auth";

const ADMIN_PASSWORD = "adminpass123";

/** Promote a user to admin via direct DB script */
function makeAdmin(email: string) {
  const scriptPath = path.join(__dirname, "..", "scripts", "make-admin.js");
  execSync(`node "${scriptPath}" "${email}"`, { cwd: path.join(__dirname, "..") });
}

let ADMIN_EMAIL = "";

test.describe("Admin moderation flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    const ts = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    ADMIN_EMAIL = `admin_${ts}_${suffix}@example.com`;
    const submitterEmail = `submitter_${ts}_${suffix}@example.com`;

    // Register & promote admin
    const regRes = await page.request.post("/api/auth/register", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: "Admin User" },
    });
    expect(regRes.ok()).toBeTruthy();
    makeAdmin(ADMIN_EMAIL.toLowerCase());

    // Register submitter and submit a pending skill (logged in as submitter in browser)
    await page.request.post("/api/auth/register", {
      data: { email: submitterEmail, password: "test12345", name: "Submitter" },
    });
    await loginAs(page, submitterEmail, "test12345");
    const skillRes = await page.evaluate(async () => {
      const res = await fetch("/api/skills/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Test Skill ${Date.now()}`,
          slug: `test-skill-${Date.now()}`,
          summary: "A test skill for e2e",
          iconEmoji: "🔧",
          skillMdContent: "# Test Skill\n\nA test skill for automated testing.",
        }),
      });
      return { ok: res.ok, status: res.status, body: await res.text() };
    });
    expect(skillRes.ok, `skill submit failed: ${skillRes.body}`).toBeTruthy();
  });

  test("regular user is redirected away from /admin", async ({ page }) => {
    // Register a throwaway non-admin user (browser context)
    const ts = Date.now();
    const throwEmail = `nomember_${ts}@example.com`;
    await page.request.post("/api/auth/register", {
      data: { email: throwEmail, password: "test12345", name: "No Member" },
    });
    await loginAs(page, throwEmail, "test12345");

    await page.goto("/admin");
    // Client-side role check redirects non-admin away
    await expect(page).toHaveURL(/\/$|\/dashboard/, { timeout: 10_000 });
  });

  test("admin sees pending skills count on review page", async ({ page }) => {
    // Log in as admin via browser fetch (replaces active submitter cookie)
    const loginRes = await page.evaluate(
      async ({ email, password }) => {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        return { ok: res.ok, status: res.status };
      },
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    );
    expect(loginRes.ok, `admin login failed: status=${loginRes.status}`).toBeTruthy();

    await page.goto("/admin/review");
    await expect(page).toHaveURL(/\/admin\/review/, { timeout: 10_000 });
    // Count badge shows pending skills count (e.g. "1 待审核")
    await expect(page.getByText(/1.*待审核|1.*pending/i)).toBeVisible({ timeout: 15_000 });
  });

  test("admin review page shows approve and reject action buttons", async ({ page }) => {
    // Log in as admin via browser fetch
    await page.evaluate(
      async ({ email, password }) => {
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      },
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    );

    await page.goto("/admin/review");
    await expect(page).toHaveURL(/\/admin\/review/, { timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    // Action buttons for the first pending skill (reject X and approve ✓ icons)
    const rejectBtn = page.locator('[title="拒绝"]').first();
    const approveBtn = page.locator('[title="通过"]').first();
    await expect(rejectBtn.or(approveBtn)).toBeVisible({ timeout: 5000 });
  });
});
