import { test, expect } from "@playwright/test";

test("App should render correctly", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/RouteOptima/);
  await expect(page.getByText("RouteOptima")).toBeVisible();

  // Wait for map to load (if possible) or at least the container
  await expect(page.locator(".h-screen")).toBeVisible();

  await expect(page).toHaveScreenshot("app-initial.png");
});
