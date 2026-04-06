import type { Page, APIRequestContext } from "@playwright/test";

/**
 * Log in as a user by filling and submitting the login form.
 * Assumes the user already exists (use registerUser to create one first).
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  // Default tab is 手机号 — switch to 邮箱 tab
  await page.getByRole("button", { name: "邮箱" }).click();
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.keyboard.press("Enter");
  await page.waitForURL("/dashboard", { timeout: 15_000 });
  // Wait for client-side /api/user/me fetch to complete before interacting
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {
    // Fallback: small delay for JS to execute
  });
}

/**
 * Register a new user via the API.
 * Returns the response (caller should check ok()).
 */
export async function registerUser(
  request: APIRequestContext,
  email: string,
  password: string,
  name = "Test User"
) {
  return request.post("/api/auth/register", {
    data: { email, password, name },
  });
}
