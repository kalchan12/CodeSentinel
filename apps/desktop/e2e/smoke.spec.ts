import { expect, test } from "@playwright/test";

// Smoke test: the app shell loads against a running local backend.
// Requires the API on :8000 (docker compose up -d --build).
test("landing page routes to projects", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/#?\/projects/);
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});

test("new project dialog opens", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await expect(page.getByText("New project")).toBeVisible();
});