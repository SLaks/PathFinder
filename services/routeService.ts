import { Address, GeoPoint } from "../types";
import { calculateOptimalSequence, getRouteShape } from "./hereService";

/**
 * Route Service
 * Handles route optimization and navigation
 */

export interface OptimizedRoute {
  sortedAddresses: Address[];
  routeShape: string[];
}

/**
 * Optimize route for a set of addresses
 * Returns sorted addresses and route polyline shape
 */
export async function optimizeRoute(
  userLocation: GeoPoint,
  addresses: Address[],
  apiKey: string
): Promise<OptimizedRoute> {
  // 1. Calculate optimal sequence
  const { sortedAddresses } = await calculateOptimalSequence(
    userLocation,
    addresses,
    apiKey
  );

  // 2. Get route shape (polyline)
  const routeShape = await getRouteShape(userLocation, sortedAddresses, apiKey);

  return {
    sortedAddresses,
    routeShape,
  };
}

/**
 * Create Google Maps navigation link for an address
 */
export function createGoogleMapsNavigationLink(address: Address): string {
  if (!address.location) return "#";

  return `https://www.google.com/maps/dir/?api=1&destination=${address.location.lat},${address.location.lng}&travelmode=driving`;
}
