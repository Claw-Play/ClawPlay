import { test, expect } from "@playwright/test";
import { loginAs, registerUser } from "./helpers/auth";

test.describe("Profile Edit Modal", () => {
  let TEST_EMAIL = "";
  const TEST_PASSWORD = "profiletest123";

  test.beforeAll(async ({ request }) => {
    TEST_EMAIL = `profile_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
    const res = await registerUser(request, TEST_EMAIL, TEST_PASSWORD, "Profile Tester");
    expect(res.ok()).toBeTruthy();
  });

  test("clicking ⚙ edit button opens ProfileEditModal", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    // The edit button has a gear emoji in its text
    const editBtn = page.getByRole("button", { name: /⚙|edit/i });
    await editBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/用户名|name/i)).toBeVisible();
  });

  test("saving with valid name updates the UI", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    const editBtn = page.getByRole("button", { name: /⚙|edit/i });
    await editBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    const nameInput = page.getByLabel(/用户名|name/i);
    await nameInput.clear();
    await nameInput.fill("Updated Name");
    await page.getByRole("button", { name: /保存|save/i }).click();

    // Wait for modal to close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 });
    // Updated name should appear in the user card
    await expect(page.getByText("Updated Name").first()).toBeVisible({ timeout: 5_000 });
  });

  test("save button is disabled when name is too short", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    const editBtn = page.getByRole("button", { name: /⚙|edit/i });
    await editBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    const nameInput = page.getByLabel(/用户名|name/i);
    await nameInput.clear();
    await nameInput.fill("A"); // too short (< 2 chars)

    // Save button should be disabled
    const saveBtn = page.getByRole("button", { name: /保存|save/i });
    await expect(saveBtn).toBeDisabled();
  });

  test("pressing Escape closes the modal", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    const editBtn = page.getByRole("button", { name: /⚙|edit/i });
    await editBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 });
  });

  test("clicking backdrop closes the modal", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    const editBtn = page.getByRole("button", { name: /⚙|edit/i });
    await editBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    // Directly dispatch a click event on the outer div (the dialog container).
    // This triggers handleBackdropClick where target === currentTarget → modal closes.
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
      dialog?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 });
  });

  test("clicking Cancel closes the modal without saving", async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });

    const editBtn = page.getByRole("button", { name: /⚙|edit/i });
    await editBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    const nameInput = page.getByLabel(/用户名|name/i);
    await nameInput.clear();
    await nameInput.fill("Should Not Save");

    await page.getByRole("button", { name: /取消|cancel/i }).click();
    // Modal should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 });
    // The name in the dashboard should not be "Should Not Save" (it should be the original or updated name)
    const heading = page.locator("h1");
    await expect(heading).not.toHaveText(/Should Not Save/);
  });
});
