import { test, expect } from "./fixtures";

test.describe("Sidebar visual tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for app to be ready
    await expect(page.getByText("RouteOptima")).toBeVisible();
  });

  test("Sidebar should render correctly", async ({ page }) => {
    // Wait for key UI elements
    await expect(page.getByText("Data Source")).toBeVisible();
    await expect(page.getByPlaceholder(/Paste addresses here/)).toBeVisible();

    // Take screenshot of sidebar only (clip to approximate sidebar width on desktop)
    await expect(page).toHaveScreenshot("sidebar-initial.png", {
      clip: { x: 0, y: 0, width: 384, height: 800 },
    });
  });

  test("Sidebar with addresses", async ({ page }) => {
    // Expand the source section if collapsed
    const sourceBox = page.locator('text="Data Source"').locator("..");
    await sourceBox.waitFor({ state: "visible" });

    // Find and fill the textarea
    const textarea = page.getByPlaceholder(/Paste addresses here/);
    await textarea.waitFor({ state: "visible" });
    await textarea.fill("123 Main St\\nNew York");

    // Click the Parse Text button
    const parseButton = page.getByRole("button", { name: "Parse Text" });
    await parseButton.click();

    // Wait for addresses to appear in the stops section
    await page.waitForTimeout(1000); // Give it time to parse

    // Wait for geocoding to finish
    await expect(page.getByText("Finding location...")).not.toBeVisible({
      timeout: 10000,
    });

    // Take screenshot of sidebar with addresses
    await expect(page).toHaveScreenshot("sidebar-with-address.png", {
      clip: { x: 0, y: 0, width: 384, height: 800 },
    });
  });

  test("Sidebar source collapsed", async ({ page }) => {
    // First connect a "mock" sheet by filling text
    const textarea = page.getByPlaceholder(/Paste addresses here/);
    await textarea.fill("Test Address");
    await page.getByRole("button", { name: "Parse Text" }).click();

    await page.waitForTimeout(500);

    // Wait for geocoding to finish
    await expect(page.getByText("Finding location...")).not.toBeVisible({
      timeout: 10000,
    });

    // Collapse the source section by clicking the header
    await page
      .getByText("Configure Import")
      .or(page.getByText("No Source Selected"))
      .click();

    await page.waitForTimeout(300);

    // Take screenshot
    await expect(page).toHaveScreenshot("sidebar-source-collapsed.png", {
      clip: { x: 0, y: 0, width: 384, height: 800 },
    });
  });
});
