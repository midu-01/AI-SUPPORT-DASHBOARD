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

  // Registration creates a default organization in the same backend flow, but
  // the client provider writes its SSR cookie after hydration. Persist that
  // organization explicitly before returning so any immediate navigation to a
  // Server Component (for example conversation detail) is correctly scoped.
  await page.evaluate(async () => {
    const response = await fetch("http://localhost:8000/api/v1/organizations", {
      credentials: "include",
    });
    if (!response.ok) throw new Error(`List organizations failed: ${response.status}`);
    const organizations = (await response.json()) as Array<{ id: string }>;
    if (!organizations[0]) throw new Error("Registration created no organization");
    localStorage.setItem("activeOrgId", organizations[0].id);
    document.cookie = `activeOrgId=${organizations[0].id}; path=/; SameSite=Lax`;
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
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

// ── Organisations ────────────────────────────────────────────────────────────

test.describe("Organisations", () => {
  test("user can switch organisations without logging out", async ({ page }) => {
    await registerAndLogin(page);

    const firstOrgName = `E2E First Org ${Date.now()}`;
    const secondOrgName = `E2E Second Org ${Date.now()}`;

    // Registration normally creates a default workspace, but this test creates
    // its own named organizations so it is independent of existing seed/data
    // policy and can assert exact option labels.
    await page
      .getByRole("button", {
        name: /create your first organisation|create a new organisation/i,
      })
      .click();
    await page.getByLabel(/organisation name/i).fill(firstOrgName);
    await page.getByRole("button", { name: /^create$/i }).click();

    await page
      .getByRole("button", { name: /create a new organisation/i })
      .click();
    await page.getByLabel(/organisation name/i).fill(secondOrgName);
    await page.getByRole("button", { name: /^create$/i }).click();

    const switcher = page.getByLabel(/active organisation/i);
    await expect(switcher).toBeVisible({ timeout: 10_000 });
    await expect(switcher.locator("option")).toHaveCount(2);

    await switcher.selectOption({ label: firstOrgName });
    await expect(switcher.locator("option:checked")).toHaveText(firstOrgName);

    // Switching changes workspace context, not authentication.
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

    // The selected organization is persisted for Server Components and reloads.
    await page.reload();
    await expect(page.getByLabel(/active organisation/i)).toBeVisible();
    await expect(
      page.getByLabel(/active organisation/i).locator("option:checked"),
    ).toHaveText(firstOrgName);
  });

  test("dashboard data is isolated by active organisation", async ({ page }) => {
    await registerAndLogin(page);

    const firstOrgName = `E2E Data Org A ${Date.now()}`;
    const secondOrgName = `E2E Data Org B ${Date.now()}`;

    // Seed through the real API using the browser's authenticated cookie. The
    // behavior under test is dashboard rendering/switching, not org creation.
    const seeded = await page.evaluate(
      async ({ firstName, secondName }) => {
        const api = "http://localhost:8000/api/v1";
        const createOrg = async (name: string) => {
          const response = await fetch(`${api}/organizations`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          if (!response.ok) throw new Error(`Create org failed: ${response.status}`);
          return response.json() as Promise<{
            organization: { id: string; name: string };
          }>;
        };

        const first = await createOrg(firstName);
        const second = await createOrg(secondName);
        return { firstId: first.organization.id, secondId: second.organization.id };
      },
      { firstName: firstOrgName, secondName: secondOrgName },
    );

    // Reload so OrgProvider fetches the newly seeded memberships, then select
    // organization A through the real UI. This synchronizes React context,
    // localStorage, the SSR cookie, and the Server Component in one action.
    await page.reload();
    const switcher = page.getByLabel(/active organisation/i);
    await expect(switcher).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      switcher.selectOption(seeded.firstId),
    ]);
    await expect(
      page.getByLabel(/active organisation/i).locator("option:checked"),
    ).toHaveText(firstOrgName);

    // Seed one record after the UI, localStorage, and SSR cookie all agree on A.
    await page.evaluate(async ({ orgId }) => {
      const response = await fetch("http://localhost:8000/api/v1/conversations", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Org-ID": orgId,
        },
        body: JSON.stringify({ title: "Org A private conversation" }),
      });
      if (!response.ok) {
        throw new Error(`Create conversation failed: ${response.status}`);
      }
    }, { orgId: seeded.firstId });

    const orgASummary = await page.evaluate(async ({ orgId }) => {
      const response = await fetch("http://localhost:8000/api/v1/dashboard/summary", {
        credentials: "include",
        headers: { "X-Org-ID": orgId },
      });
      if (!response.ok) {
        throw new Error(`Dashboard summary failed: ${response.status}`);
      }
      return response.json() as Promise<{
        recent_conversations: Array<{ title: string }>;
      }>;
    }, { orgId: seeded.firstId });
    expect(orgASummary.recent_conversations.map((item) => item.title)).toContain(
      "Org A private conversation",
    );
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((cookie) => cookie.name === "activeOrgId")?.value;
      })
      .toBe(seeded.firstId);
    await page.goto("/");
    await expect(
      page.getByText("Org A private conversation", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByLabel(/active organisation/i).selectOption(seeded.secondId),
    ]);
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((cookie) => cookie.name === "activeOrgId")?.value;
      })
      .toBe(seeded.secondId);
    await page.goto("/");
    await expect(page.getByText("No conversations yet.")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText("Org A private conversation", { exact: true }),
    ).toHaveCount(0);

    // Switching back must fetch organization A's dashboard data again.
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByLabel(/active organisation/i).selectOption(seeded.firstId),
    ]);
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((cookie) => cookie.name === "activeOrgId")?.value;
      })
      .toBe(seeded.firstId);
    await page.goto("/");
    await expect(
      page.getByText("Org A private conversation", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
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

  test("rename persists after reload", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/conversations");
    await page.getByRole("button", { name: /new conversation/i }).click();
    // The list mutation can finish before a server detail navigation resolves;
    // return to the list and follow the persisted resource link explicitly.
    await page.goto("/conversations");
    const detailHref = await page
      .getByRole("link", { name: /new conversation/i })
      .first()
      .getAttribute("href");
    expect(detailHref).toBeTruthy();
    await page.goto(detailHref!);
    await expect(page.getByRole("button", { name: /rename conversation/i })).toBeVisible();

    const renamedTitle = `Renamed conversation ${Date.now()}`;
    await page.getByRole("button", { name: /rename conversation/i }).click();
    await page.getByLabel(/conversation title/i).fill(renamedTitle);
    await page.getByRole("button", { name: /save title/i }).click();
    await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();
  });

  test("message is added to history and persists after reload", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/conversations");
    await page.getByRole("button", { name: /new conversation/i }).click();
    await page.goto("/conversations");
    const detailHref = await page
      .getByRole("link", { name: /new conversation/i })
      .first()
      .getAttribute("href");
    expect(detailHref).toBeTruthy();
    await page.goto(detailHref!);
    await expect(page.getByLabel("Message")).toBeVisible();

    const message = `E2E support message ${Date.now()}`;
    await page.getByLabel("Message").fill(message);
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  });

  test("delete removes the conversation and returns to the list", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/conversations");
    await page.getByRole("button", { name: /new conversation/i }).click();
    await page.goto("/conversations");
    const detailHref = await page
      .getByRole("link", { name: /new conversation/i })
      .first()
      .getAttribute("href");
    expect(detailHref).toBeTruthy();
    await page.goto(detailHref!);
    await expect(page.getByRole("button", { name: /delete conversation/i })).toBeVisible();

    const deletedUrl = page.url();
    await page.getByRole("button", { name: /delete conversation/i }).click();
    const dialog = page.getByRole("dialog", { name: /delete conversation/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^delete$/i }).click();
    await expect(page).toHaveURL(/\/conversations$/, { timeout: 10_000 });

    // The deleted detail route is no longer accessible.
    await page.goto(deletedUrl);
    await expect(page).toHaveURL(/\/conversations$/, { timeout: 10_000 });
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

  const uploadCases = [
    {
      label: "PDF",
      name: "e2e-support-guide.pdf",
      mimeType: "application/pdf",
      // Minimal PDF-like payload. The backend validates the real PDF signature
      // while the assessment explicitly does not require document processing.
      buffer: Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
      ),
    },
    {
      label: "DOCX",
      name: "e2e-support-guide.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // DOCX is a ZIP container; PK\x03\x04 is the signature validated by the
      // backend before metadata is accepted.
      buffer: Buffer.from("504b0304140000000800", "hex"),
    },
    {
      label: "TXT",
      name: "e2e-support-guide.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Customer support runbook for the E2E upload flow.\n"),
    },
  ] as const;

  for (const file of uploadCases) {
    test(`uploads and persists ${file.label} metadata`, async ({ page }) => {
      await registerAndLogin(page);
      await page.goto("/documents");

      const uploadZone = page.getByRole("button", {
        name: /upload a document/i,
      }).last();
      await expect(uploadZone).toBeVisible();
      await expect(page.getByText("No documents uploaded yet.").last()).toBeVisible();
      await uploadZone.locator('input[type="file"]').setInputFiles({
        name: file.name,
        mimeType: file.mimeType,
        buffer: file.buffer,
      });
      await expect(page.getByText(file.name, { exact: true }).last()).toBeVisible({
        timeout: 10_000,
      });

      // The row is database-backed rather than a temporary upload preview.
      await page.reload();
      await expect(page.getByText(file.name, { exact: true }).last()).toBeVisible({
        timeout: 10_000,
      });

      // Exercise cleanup through the user-facing delete path as part of the
      // TXT case; the other two remain available for visual inspection.
      if (file.label === "TXT") {
        await page
          .getByRole("button", { name: `Delete "${file.name}"` })
          .click();
        const dialog = page.getByRole("dialog", { name: /delete document/i });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: /^delete$/i }).click();
        await expect(page.getByText(file.name, { exact: true })).toHaveCount(0);
      }
    });
  }
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
