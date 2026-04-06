import type { Page, APIRequestContext } from "@playwright/test";

/**
 * Log in as a user by filling and submitting the login form.
 * Assumes the user already exists (use registerUser to create one first).
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.keyboard.press("Enter");
  await page.waitForURL("/dashboard", { timeout: 15_000 });
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
