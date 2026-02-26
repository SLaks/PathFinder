import { test, expect } from "./fixtures";

test("App should render correctly", async ({ page }) => {
  await page.goto("/");

  // Wait for the main elements to load
  await expect(page.getByText("PathFinder")).toBeVisible();
  await expect(page.getByText("Import. Plan. Navigate.")).toBeVisible();

  // Wait for the map container - using data-testid or class
  await page.waitForSelector('[class*="h-screen"]', { timeout: 5000 });

  // Wait a bit for map to initialize
  await page.waitForTimeout(2000);

  // Take full page screenshot
  await expect(page).toHaveScreenshot("app-initial.png", {
    fullPage: false,
    mask: [
      // Mask any dynamic map elements that might change
      page.locator("canvas").nth(0),
    ],
  });
});

test("App with dark mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("PathFinder")).toBeVisible();

  // Find and click the dark mode toggle
  const darkModeToggle = page
    .locator("button")
    .filter({ hasText: /theme|mode/i })
    .or(
      page
        .locator('[aria-label*="dark"]')
        .or(page.locator('[aria-label*="theme"]')),
    )
    .first();

  // If toggle exists, click it
  if ((await darkModeToggle.count()) > 0) {
    await darkModeToggle.click();
    await page.waitForTimeout(500);
  }

  await expect(page).toHaveScreenshot("app-dark-mode.png", {
    fullPage: false,
    mask: [page.locator("canvas").nth(0)],
  });
});

test("App mobile layout with bottom sheet", async ({ page }) => {
  // Set viewport to mobile size
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  // Wait for map
  await page.waitForSelector('[class*="h-screen"]', { timeout: 5000 });
  await page.waitForTimeout(2000);

  // Check if Bottom Sheet is visible
  // The bottom sheet is a Paper component with fixed position bottom: 0
  // We can look for the drag handle or specific text in the sidebar
  await expect(page.getByText("PathFinder")).toBeVisible();

  // Take screenshot of mobile view
  await expect(page).toHaveScreenshot("app-mobile.png", {
    fullPage: false,
    mask: [page.locator("canvas").nth(0)],
  });
});
