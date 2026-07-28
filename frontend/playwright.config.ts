import { defineConfig } from "@playwright/test";

/**
 * Playwright E2E configuration.
 *
 * Assumes the backend (port 8000) and frontend (port 3000) are already running.
 * Start them before running `npx playwright test`:
 *
 *   cd backend && .venv/bin/uvicorn app.main:app --reload &
 *   cd frontend && npm run dev &
 *   npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // tests share state (registered user), run sequentially
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    // Persist cookies across tests in the same file so login carries over.
    storageState: undefined,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
