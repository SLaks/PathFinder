import { test, expect } from "@playwright/test";

test("AddressCard should render correctly", async ({ page }) => {
  await page.goto("/");

  // Add an address to generate a card
  await page.getByPlaceholder(/Paste addresses here/).fill("Test Address 123");
  await page.getByText("Parse Text").click();

  const card = page.getByText("Test Address 123").locator(".."); // Get parent container of the text
  await expect(card).toBeVisible();

  await expect(card).toHaveScreenshot("address-card.png");
});
