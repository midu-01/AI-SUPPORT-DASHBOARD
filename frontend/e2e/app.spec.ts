import { test, expect } from "@playwright/test";

/**
 * E2E tests for the AI Support Dashboard.
 *
 * These tests run against a live backend + frontend and exercise the critical
 * user flows that §6 of the engineering report lists as "checked by hand".
 * Converting them to Playwright is exactly what §7 says should come next.
 *
 * Each test registers a fresh user (unique email per test) so tests are fully
 * independent and can run in any order.
 */

const PASSWORD = "TestPassword123!";
const FULL_NAME = "E2E Test User";

/** Generate a unique email for each test to avoid collisions. */
function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`;
}

/** Register a fresh user, then log in and wait for the dashboard. */
async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = uniqueEmail();
  await page.goto("/register");
  await page.getByLabel(/full name/i).fill(FULL_NAME);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL("/", { timeout: 10_000 });
  return email;
}

/** Log in with an existing account. */
async function login(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL("/", { timeout: 10_000 });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

test.describe("Auth flow", () => {
  test("signed-out user is redirected to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("register creates account and lands on dashboard", async ({ page }) => {
    await registerAndLogin(page);
    await expect(page.getByText(FULL_NAME)).toBeVisible({ timeout: 5_000 });
  });

  test("login with existing account works", async ({ page }) => {
    const email = await registerAndLogin(page);
    // Log out, then log back in.
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await login(page, email);
    await expect(page.getByText(FULL_NAME)).toBeVisible({ timeout: 5_000 });
  });

  test("login rejects wrong password", async ({ page }) => {
    const email = await registerAndLogin(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("WrongPassword999!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("already-signed-in user bounces off /login", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/login");
    await expect(page).toHaveURL("/", { timeout: 10_000 });
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

test.describe("Dashboard", () => {
  test("dashboard loads with user info", async ({ page }) => {
    await registerAndLogin(page);
    await expect(page.getByText(FULL_NAME)).toBeVisible({ timeout: 5_000 });
  });

  test("dashboard has no horizontal overflow at mobile width", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
});

// ── Conversations ─────────────────────────────────────────────────────────────

test.describe("Conversations", () => {
  test("create a conversation navigates to detail page", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/conversations");

    const createBtn = page.getByRole("button", {
      name: /new conversation/i,
    });
    await createBtn.click();

    // The create mutation navigates to /conversations/<uuid> on success.
    // Wait for the URL to change away from the bare /conversations path.
    await page.waitForURL(/\/conversations\/[a-f0-9-]+/, {
      timeout: 10_000,
    });
  });

  test("search input is visible on conversations page", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/conversations");
    // Use .first() because mobile and desktop both render a search input.
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
  });
});

// ── Documents ─────────────────────────────────────────────────────────────────

test.describe("Documents", () => {
  test("documents page loads with upload area", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/documents");
    await expect(
      page.getByText(/upload|drag|drop|browse/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

test.describe("Logout", () => {
  test("logout clears session and redirects to login", async ({ page }) => {
    await registerAndLogin(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Navigating to dashboard should redirect back to login.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
