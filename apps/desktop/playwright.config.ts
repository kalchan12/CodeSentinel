import { defineConfig, devices } from "@playwright/test";

/**
 * Optional end-to-end tests for the desktop UI.
 *
 * Usage:
 *   1. Start the backend stack:  docker compose up -d --build
 *   2. Start the frontend:       npm run dev:desktop
 *   3. npx playwright install chromium
 *   4. npm run e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});