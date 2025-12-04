import { GeoPoint, Address, TransitMode } from "../types";

// HERE API Response Types
interface HereWaypoint {
  id: string;
  sequence: number;
}

interface HereRouteSection {
  polyline: string;
}

interface HereGeocodeResponse {
  items?: Array<{
    position: GeoPoint;
    address: { label: string };
  }>;
}

interface HereSequenceResponse {
  results?: Array<{
    waypoints: HereWaypoint[];
  }>;
}

interface HereRoutingResponse {
  routes?: Array<{
    sections: HereRouteSection[];
  }>;
}

type HereApiResponse =
  | HereGeocodeResponse
  | HereSequenceResponse
  | HereRoutingResponse;

const GEOCODE_URL = "https://geocode.search.hereapi.com/v1/geocode";
const SEQUENCE_URL = "https://wps.hereapi.com/v8/findsequence2";
const ROUTING_URL = "https://router.hereapi.com/v8/routes";

// Cache Configuration
const CACHE_KEY = "routeoptima_geocode_cache";
const MAX_CACHE_SIZE = 100;

interface CacheEntry {
  key: string;
  data: { position: GeoPoint; address: string };
  timestamp: number;
}

// Helper to get from local storage
function getFromCache(
  key: string,
): { position: GeoPoint; address: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: CacheEntry[] = JSON.parse(raw);
    const entry = cache.find((c) => c.key === key);
    return entry ? entry.data : null;
  } catch {
    return null;
  }
}

// Helper to save to local storage
function addToCache(
  key: string,
  data: { position: GeoPoint; address: string },
) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    let cache: CacheEntry[] = raw ? JSON.parse(raw) : [];

    // Remove existing to avoid dupes and to bring to front on re-add
    cache = cache.filter((c) => c.key !== key);

    // Add to start (LRU-ish)
    cache.unshift({ key, data, timestamp: Date.now() });

    // Trim to max size
    if (cache.length > MAX_CACHE_SIZE) {
      cache = cache.slice(0, MAX_CACHE_SIZE);
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to update geocode cache", e);
  }
}

async function fetchWithChecks(
  url: string,
  apiName: string,
): Promise<HereApiResponse> {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`${apiName} network error. Please check your connection.`);
  }

  if (response.status === 429) {
    const limit = response.headers.get("X-RateLimit-Limit") || "N/A";
    const remaining = response.headers.get("X-RateLimit-Remaining") || "N/A";
    const reset = response.headers.get("X-RateLimit-Reset") || "N/A";
    throw new Error(
      `Rate limit exceeded for ${apiName}.\nLimit: ${limit}\nRemaining: ${remaining}\nReset: ${reset}`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let msg = `${apiName} request failed: ${response.status} ${response.statusText}`;

    // Try to parse HERE API error structure
    try {
      const jsonError = JSON.parse(errorText);
      if (jsonError.title) {
        msg += ` - ${jsonError.title}`;
      } else if (jsonError.error_description) {
        msg += ` - ${jsonError.error_description}`;
      }
    } catch {
      // ignore JSON parse errors
    }

    throw new Error(msg);
  }

  return response.json();
}

export const geocodeAddress = async (
  query: string,
  apiKey: string,
  userLocation?: GeoPoint,
): Promise<{ position: GeoPoint; address: string } | null> => {
  // 1. Check Cache
  const cached = getFromCache(query);
  if (cached) {
    return cached;
  }

  try {
    const url = new URL(GEOCODE_URL);
    url.searchParams.append("q", query);
    url.searchParams.append("apiKey", apiKey);
    if (userLocation) {
      url.searchParams.append("at", `${userLocation.lat},${userLocation.lng}`);
    }

    const data = (await fetchWithChecks(
      url.toString(),
      "Geocoding",
    )) as HereGeocodeResponse;

    if (data.items && data.items.length > 0) {
      const result = {
        position: data.items[0].position,
        address: data.items[0].address.label,
      };

      // 2. Update Cache
      addToCache(query, result);

      return result;
    }
    return null;
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Rate limit")) throw e;
    console.error("Geocoding error", e);
    return null;
  }
};

export const calculateOptimalSequence = async (
  start: GeoPoint,
  destinations: Address[],
  apiKey: string,
  transitMode: TransitMode = "car",
): Promise<{ sortedAddresses: Address[] }> => {
  const url = new URL(SEQUENCE_URL);
  url.searchParams.append("apiKey", apiKey);
  url.searchParams.append("mode", `fastest;${transitMode};traffic:disabled`);
  url.searchParams.append("start", `${start.lat},${start.lng}`);

  // Ensure we only send valid, geocoded locations and maintain strict indexing (destination1, destination2, etc.)
  const validDestinations = destinations.filter((d) => d.location);

  validDestinations.forEach((addr, index) => {
    if (addr.location) {
      url.searchParams.append(
        `destination${index + 1}`,
        `${addr.id};${addr.location.lat},${addr.location.lng}`,
      );
    }
  });

  const data = (await fetchWithChecks(
    url.toString(),
    "Waypoint Sequence",
  )) as HereSequenceResponse;

  if (data.results && data.results[0] && data.results[0].waypoints) {
    const waypoints = data.results[0].waypoints;
    const sorted: Address[] = [];

    waypoints.forEach((wp: HereWaypoint) => {
      if (wp.id === "start") return;
      const original = validDestinations.find((d) => d.id === wp.id);
      if (original) {
        sorted.push({ ...original, sequenceOrder: wp.sequence });
      }
    });

    return { sortedAddresses: sorted };
  }

  throw new Error("No sequence found in API response");
};

export const getRouteShape = async (
  start: GeoPoint,
  sortedWaypoints: Address[],
  apiKey: string,
  transitMode: TransitMode = "car",
): Promise<string[]> => {
  if (sortedWaypoints.length > 0) {
    const last = sortedWaypoints[sortedWaypoints.length - 1];
    const intermediates = sortedWaypoints.slice(0, -1);

    const v8Url = new URL(ROUTING_URL);
    v8Url.searchParams.append("apiKey", apiKey);
    v8Url.searchParams.append("transportMode", transitMode);
    v8Url.searchParams.append("origin", `${start.lat},${start.lng}`);

    intermediates.forEach((wp) => {
      if (wp.location)
        v8Url.searchParams.append(
          "via",
          `${wp.location.lat},${wp.location.lng}`,
        );
    });

    if (last.location) {
      v8Url.searchParams.append(
        "destination",
        `${last.location.lat},${last.location.lng}`,
      );
    }

    v8Url.searchParams.append("return", "polyline");

    const d = (await fetchWithChecks(
      v8Url.toString(),
      "Routing V8",
    )) as HereRoutingResponse;

    if (d.routes && d.routes.length > 0) {
      return d.routes[0].sections.map((s: HereRouteSection) => s.polyline);
    }
  }
  return [];
};
