import type { Page, APIRequestContext } from "@playwright/test";

/**
 * Log in as a user by filling and submitting the login form.
 * Goes to /dashboard first — middleware redirects unauthenticated users to /login.
 * After form submit, waits for the URL to change away from /login.
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/dashboard", { waitUntil: "networkidle" });

  if (!page.url().includes("/login")) {
    // Already on dashboard — user is logged in
    return;
  }

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.keyboard.press("Enter");
  await page.waitForURL(/^(?!.*\/login)/, { timeout: 15_000 });
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
