import { describe, it, expect, vi } from "vitest";
import * as routeService from "./routeService";
import * as hereService from "./hereService";
import { Address, GeoPoint } from "../types";

// Mock hereService
vi.mock("./hereService", () => ({
  calculateOptimalSequence: vi.fn(),
  getRouteShape: vi.fn(),
}));

describe("routeService", () => {
  describe("optimizeRoute", () => {
    it("should return optimized route with sorted addresses and shape", async () => {
      const userLocation: GeoPoint = { lat: 0, lng: 0 };
      const addresses: Address[] = [{ id: "1", originalText: "A" }];
      const apiKey = "test-key";
      const sortedAddresses = [...addresses];
      const routeShape = ["polyline-string"];

      vi.mocked(hereService.calculateOptimalSequence).mockResolvedValue({
        sortedAddresses,
      });
      vi.mocked(hereService.getRouteShape).mockResolvedValue(routeShape);

      const result = await routeService.optimizeRoute(
        userLocation,
        addresses,
        apiKey,
      );

      expect(result).toEqual({
        sortedAddresses,
        routeShape,
      });
      expect(hereService.calculateOptimalSequence).toHaveBeenCalledWith(
        userLocation,
        addresses,
        apiKey,
      );
      expect(hereService.getRouteShape).toHaveBeenCalledWith(
        userLocation,
        sortedAddresses,
        apiKey,
      );
    });
  });

  describe("createGoogleMapsNavigationLink", () => {
    it("should create a valid Google Maps link", () => {
      const address: Address = {
        id: "1",
        originalText: "Test",
        location: { lat: 10, lng: 20 },
      };

      const link = routeService.createGoogleMapsNavigationLink(address);
      expect(link).toBe(
        "https://www.google.com/maps/dir/?api=1&destination=10,20&travelmode=driving",
      );
    });

    it("should return # if address has no location", () => {
      const address: Address = {
        id: "1",
        originalText: "Test",
      };

      const link = routeService.createGoogleMapsNavigationLink(address);
      expect(link).toBe("#");
    });
  });
});
