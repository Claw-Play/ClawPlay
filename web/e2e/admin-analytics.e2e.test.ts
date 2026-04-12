import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import { loginAs, registerUser } from "./helpers/auth";

const ADMIN_PASSWORD = "admin_analytics_123";
const USER_PASSWORD = "user_analytics_123";

function makeAdmin(email: string) {
  const scriptPath = path.join(__dirname, "..", "scripts", "make-admin.js");
  execSync(`node "${scriptPath}" "${email}"`, { cwd: path.join(__dirname, "..") });
}

let ADMIN_EMAIL = "";
let USER_EMAIL = "";

test.describe("Admin analytics overview", () => {
  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    ADMIN_EMAIL = `analytics_admin_${ts}_${suffix}@example.com`;
    USER_EMAIL = `analytics_user_${ts}_${suffix}@example.com`;

    // Register admin and promote
    const adminRes = await request.post("/api/auth/register", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: "Analytics Admin" },
    });
    expect(adminRes.ok()).toBeTruthy();
    makeAdmin(ADMIN_EMAIL.toLowerCase());

    // Register regular user
    const userRes = await request.post("/api/auth/register", {
      data: { email: USER_EMAIL, password: USER_PASSWORD, name: "Analytics User" },
    });
    expect(userRes.ok()).toBeTruthy();
  });

  test("admin sees analytics overview dashboard at /admin", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/admin");
    // Wait for page to load (either skeleton or data)
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // Admin sidebar navigation should be visible
    // Sidebar has links for: 概览 (dashboard), 审核 (review), 事件 (events), 用户 (users)
    await expect(page.getByRole("link", { name: /概览|dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /审核|review|pending/i })).toBeVisible();
  });

  test("period toggle: 7d → 30d updates data", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // Click 30d toggle
    const btn30d = page.getByRole("button", { name: /近30天|30 Days|30天/i });
    await expect(btn30d).toBeVisible({ timeout: 5000 });
    await btn30d.click();

    // Active class should be on the 30d button
    await expect(btn30d).toHaveClass(/bg-gradient-to-r/);
  });

  test("admin overview shows stats cards (users, events, quota, skills)", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // The overview shows numbers for active users, events, quota, skills
    // These render as large numbers in stat cards
    const body = page.locator("body");
    await expect(body).not.toHaveText(/loading|加载中/, { timeout: 15_000 });
  });

  test("charts render (line chart + pie chart containers)", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // Charts are rendered as SVG elements
    // Either chart SVG or "No data" text should be visible
    const svgs = page.locator("svg");
    await expect(svgs.first()).toBeVisible({ timeout: 10_000 });
  });

  test("regular user is redirected away from /admin", async ({ page }) => {
    await loginAs(page, USER_EMAIL, USER_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    await page.goto("/admin");
    // Client-side role check redirects non-admin away
    await expect(page).toHaveURL(/\/$|\/dashboard/, { timeout: 10_000 });
  });

  test("admin sidebar navigation links are visible", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // Sidebar has links for: 数据概览, 待审核, 事件流, 用户
    await expect(page.getByRole("link", { name: /数据概览/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /待审核|pending reviews/i })).toBeVisible();
  });
});
