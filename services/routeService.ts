import { Address, GeoPoint, TransitMode } from "../types";
import { calculateOptimalSequence, getRouteShape } from "./hereService";

/**
 * Route Service
 * Handles route optimization and navigation
 */

export interface OptimizedRoute {
  sortedAddresses: Address[];
  routeShape: string[];
  actions: HereAction[];
}

import { HereAction } from "./hereService";

/**
 * Optimize route for a set of addresses
 * Returns sorted addresses and route polyline shape
 */
export async function optimizeRoute(
  userLocation: GeoPoint,
  addresses: Address[],
  apiKey: string,
  transitMode: TransitMode = "car",
): Promise<OptimizedRoute> {
  // 1. Calculate optimal sequence
  const { sortedAddresses } = await calculateOptimalSequence(
    userLocation,
    addresses,
    apiKey,
    transitMode,
  );

  // 2. Get route shape (polyline) & actions
  const { polylines, actions } = await getRouteShape(
    userLocation,
    sortedAddresses,
    apiKey,
    transitMode,
  );

  return {
    sortedAddresses,
    routeShape: polylines,
    actions,
  };
}

/**
 * Create Google Maps navigation link for an address
 */
export function createGoogleMapsNavigationLink(
  address: Address,
  transitMode: TransitMode = "car",
): string {
  if (!address.location) return "#";

  // Map our transit modes to Google Maps travel modes
  const travelModeMap: Record<TransitMode, string> = {
    car: "driving",
    truck: "driving",
    pedestrian: "walking",
    bicycle: "bicycling",
  };

  const travelMode = travelModeMap[transitMode];

  return `https://www.google.com/maps/dir/?api=1&destination=${address.location.lat},${address.location.lng}&travelmode=${travelMode}`;
}
