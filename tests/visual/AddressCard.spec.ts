import { test, expect } from "./fixtures";

test.describe("AddressCard visual tests", () => {
  test("AddressCard should render correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PathFinder")).toBeVisible();

    // Add an address to generate a card
    const textarea = page.getByPlaceholder(/Paste addresses here/);
    await textarea.fill("John Doe | 123 Main St, New York, NY 10001");

    const parseButton = page.getByRole("button", { name: "Parse Text" });
    await parseButton.click();

    // Wait for address to be parsed and card to appear
    await page.waitForTimeout(1000);

    // Wait for the address text to appear
    await expect(page.getByText("123 Main St")).toBeVisible({ timeout: 5000 });

    // Wait for geocoding to finish
    await expect(page.getByText("Finding location...")).not.toBeVisible({
      timeout: 10000,
    });

    // Find the address card - it should be in the Stops section
    const addressCard = page
      .locator(".mantine-Paper-root")
      .filter({
        hasText: "123 Main St",
      })
      .first();

    await expect(addressCard).toBeVisible();

    // Screenshot just the card
    await expect(addressCard).toHaveScreenshot("address-card.png");
  });

  test("AddressCard with completion checkbox", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("PathFinder")).toBeVisible();

    // Add an address
    const textarea = page.getByPlaceholder(/Paste addresses here/);
    await textarea.fill("Jane Smith | 456 Oak Ave, Boston, MA 02101");
    await page.getByRole("button", { name: "Parse Text" }).click();

    await page.waitForTimeout(1000);
    await expect(page.getByText("456 Oak Ave")).toBeVisible({ timeout: 5000 });

    // Wait for geocoding to finish
    await expect(page.getByText("Finding location...")).not.toBeVisible({
      timeout: 10000,
    });

    // Find the card
    const addressCard = page
      .locator(".mantine-Paper-root")
      .filter({
        hasText: "456 Oak Ave",
      })
      .first();

    // Screenshot the card
    await expect(addressCard).toHaveScreenshot(
      "address-card-with-checkbox.png",
    );
  });

  test("AddressCard in completed state", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("PathFinder")).toBeVisible();

    // Add an address
    const textarea = page.getByPlaceholder(/Paste addresses here/);
    await textarea.fill("Test User | 789 Pine St, Seattle, WA 98101");
    await page.getByRole("button", { name: "Parse Text" }).click();

    await page.waitForTimeout(1000);
    await expect(page.getByText("789 Pine St")).toBeVisible({ timeout: 5000 });

    // Wait for geocoding to finish
    await expect(page.getByText("Finding location...")).not.toBeVisible({
      timeout: 10000,
    });

    // Find and click the checkbox to complete it
    const checkbox = page.locator('input[type="checkbox"]').first();
    if ((await checkbox.count()) > 0) {
      await checkbox.click();
      await page.waitForTimeout(300);
    }

    // Find the completed card (might be in the completed section)
    const completedCard = page
      .locator(".mantine-Paper-root")
      .filter({
        hasText: "789 Pine St",
      })
      .first();

    await expect(completedCard).toHaveScreenshot("address-card-completed.png");
  });
});
