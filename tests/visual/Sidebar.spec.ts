import { test, expect } from "@playwright/test";

test("Sidebar should render correctly", async ({ page }) => {
  await page.goto("/");

  // Check sidebar elements
  await expect(page.getByText("RouteOptima")).toBeVisible();
  await expect(page.getByPlaceholder(/Paste addresses here/)).toBeVisible();

  await expect(page).toHaveScreenshot("sidebar-initial.png", {
    mask: [page.locator(".leaflet-container")], // Mask map if it's visible and causing flakiness, though this test focuses on sidebar
    clip: { x: 0, y: 0, width: 400, height: 1000 }, // Approximate sidebar area if it's fixed width
  });
});

test("Sidebar with addresses", async ({ page }) => {
  await page.goto("/");

  // Add an address
  await page.getByPlaceholder(/Paste addresses here/).fill("123 Main St");
  await page.getByText("Parse Text").click();

  // Wait for address to appear
  await expect(page.getByText("123 Main St")).toBeVisible();

  await expect(page).toHaveScreenshot("sidebar-with-address.png", {
    clip: { x: 0, y: 0, width: 400, height: 1000 },
  });
});
