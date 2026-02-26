import { test, expect } from "./fixtures";

test.describe("Route optimization visual tests", () => {
  test("Optimize button disabled state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PathFinder")).toBeVisible();

    // The optimize button should be disabled with no addresses
    const optimizeButton = page.getByRole("button", {
      name: /Optimize Route/i,
    });
    await expect(optimizeButton).toBeDisabled();

    // Screenshot the footer with disabled button
    const footer = page.locator('text="Optimize Route"').locator("../..");
    await expect(footer).toHaveScreenshot("optimize-button-disabled.png");
  });

  test("Optimize button with single address", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PathFinder")).toBeVisible();

    // Add one address
    const textarea = page.getByPlaceholder(/Paste addresses here/);
    await textarea.fill("123 Main St, City");
    await page.getByRole("button", { name: "Parse Text" }).click();
    await page.waitForTimeout(1000);

    // Button should still be disabled (need at least 2 addresses)
    const optimizeButton = page.getByRole("button", {
      name: /Optimize Route/i,
    });
    await expect(optimizeButton).toBeDisabled();
  });

  test("Optimize button enabled state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PathFinder")).toBeVisible();

    // Add multiple addresses
    const textarea = page.getByPlaceholder(/Paste addresses here/);
    await textarea.fill(
      "123 Main St, City\\n456 Oak Ave, Town\\n789 Pine Rd, Village",
    );
    await page.getByRole("button", { name: "Parse Text" }).click();

    // Wait for geocoding to finish (button is disabled while geocoding)
    await expect(page.getByText("Finding location...")).not.toBeVisible({
      timeout: 10000,
    });

    // Screenshot the footer with enabled button
    const footer = page.locator('text="Optimize Route"').locator("../..");
    await expect(footer).toHaveScreenshot("optimize-button-enabled.png");
  });

  test("Transit mode selector", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PathFinder")).toBeVisible();

    // Find the transit mode button (should show "Car" by default)
    const transitModeButton = page.getByRole("button", { name: /Car/i });
    await expect(transitModeButton).toBeVisible();

    // Click to open the menu
    await transitModeButton.click();
    await page.waitForTimeout(300);

    // Screenshot the open menu
    await expect(page).toHaveScreenshot("transit-mode-menu.png", {
      clip: { x: 0, y: 400, width: 400, height: 400 },
    });
  });

  test("Clear button functionality", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PathFinder")).toBeVisible();

    // Add addresses
    const textarea = page.getByPlaceholder(/Paste addresses here/);
    await textarea.fill("Address 1\\nAddress 2\\nAddress 3");
    await page.getByRole("button", { name: "Parse Text" }).click();
    await page.waitForTimeout(1000);

    // Screenshot with Clear button visible
    const stopsSection = page.locator('text="Stops"').locator("..");
    await expect(stopsSection).toHaveScreenshot("stops-with-clear-button.png");
  });
});
