import { test as base } from "@playwright/test";

// Extend base test with custom fixtures
export const test = base.extend({
  // Auto-authenticate before each test
  page: async ({ page }, use) => {
    // Set up a route to intercept localStorage access and inject API key
    await page.addInitScript(() => {
      localStorage.setItem("here_api_key", "mock-here-api-key-for-testing");
    });

    // Mock HERE Geocoding API
    await page.route("**/geocode.search.hereapi.com/v1/geocode*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              position: { lat: 40.7128, lng: -74.006 },
              address: { label: "Mock Address, New York, NY" },
            },
          ],
        }),
      });
    });

    // Mock HERE Sequence API
    await page.route("**/wps.hereapi.com/v8/findsequence2*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              waypoints: [
                { id: "start", sequence: 0 },
                { id: "destination1", sequence: 1 },
                { id: "destination2", sequence: 2 },
                { id: "destination3", sequence: 3 },
              ],
            },
          ],
        }),
      });
    });

    // Mock HERE Routing API
    await page.route("**/router.hereapi.com/v8/routes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          routes: [
            {
              sections: [
                { polyline: "mock_polyline_data" },
              ],
            },
          ],
        }),
      });
    });

    // Use the page for the test
    await use(page);
  },
});

export { expect } from "@playwright/test";
