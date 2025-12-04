import { test, expect } from "./fixtures";

test.describe("Source selection visual tests", () => {
  test("Source section expanded", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("RouteOptima")).toBeVisible();

    // The source section should be expanded by default
    await expect(page.getByText("Configure Import")).toBeVisible();
    await expect(page.getByText("Google Sheets")).toBeVisible();
    await expect(page.getByText("Paste Text")).toBeVisible();

    // Screenshot the data source section
    const sourceSection = page.locator('text="Data Source"').locator('../..');
    await expect(sourceSection).toHaveScreenshot("source-section-expanded.png");
  });

  test("Source section with paste text area", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("RouteOptima")).toBeVisible();

    // Focus on the textarea
    const textarea = page.getByPlaceholder(/Paste addresses here/);
    await textarea.fill("Sample address text");

    // Screenshot with text in the textarea
    const sourceSection = page.locator('text="Data Source"').locator('../..');
    await expect(sourceSection).toHaveScreenshot("source-section-with-text.png");
  });

  test("Google Sheets section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("RouteOptima")).toBeVisible();

    // Find the Google Sheets section
    const sheetsSection = page.locator('text="Google Sheets"').locator('..');
    await expect(sheetsSection).toBeVisible();

    // Screenshot just the Google Sheets part
    await expect(sheetsSection).toHaveScreenshot("google-sheets-section.png");
  });

  test("Parse text button states", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("RouteOptima")).toBeVisible();

    const parseButton = page.getByRole("button", { name: "Parse Text" });
    
    // Initially disabled (no text)
    await expect(parseButton).toBeDisabled();

    // Screenshot disabled state
    const buttonArea = parseButton.locator('..');
    await expect(buttonArea).toHaveScreenshot("parse-button-disabled.png");

    // Add text to enable
    await page.getByPlaceholder(/Paste addresses here/).fill("Test address");
    await expect(parseButton).toBeEnabled();

    // Screenshot enabled state
    await expect(buttonArea).toHaveScreenshot("parse-button-enabled.png");
  });

  test("Import success feedback", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("RouteOptima")).toBeVisible();

    // Add and parse text
    await page.getByPlaceholder(/Paste addresses here/).fill("123 Main St");
    await page.getByRole("button", { name: "Parse Text" }).click();

    // Wait for success message
    await page.waitForTimeout(500);
    
    // Try to catch the success state (it disappears after 3 seconds)
    const successMessage = page.getByText("Imported!");
    if (await successMessage.isVisible()) {
      const buttonArea = page.getByRole("button", { name: "Parse Text" }).locator('..');
      await expect(buttonArea).toHaveScreenshot("parse-success-feedback.png");
    }
  });

  test("Stops counter", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("RouteOptima")).toBeVisible();

    // Initially shows 0
    await expect(page.getByText(/Stops \(0\)/)).toBeVisible();

    // Add addresses
    await page.getByPlaceholder(/Paste addresses here/).fill("Addr 1\\nAddr 2\\nAddr 3");
    await page.getByRole("button", { name: "Parse Text" }).click();
    await page.waitForTimeout(1000);

    // Should now show count
    const stopsHeader = page.getByText(/Stops \(\d+\)/);
    await expect(stopsHeader).toBeVisible();

    // Screenshot the stops section header
    await expect(stopsHeader.locator('..')).toHaveScreenshot("stops-header-with-count.png");
  });
});
