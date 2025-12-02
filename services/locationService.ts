import { Address, GeoPoint } from "../types";
import { geocodeAddress } from "./hereService";

/**
 * Location Service
 * Handles geolocation and geocoding operations
 */

/**
 * Get user's current location via browser geolocation API
 */
export function getUserLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let message = "Error getting location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message =
              "Location access denied. Please enable location services.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable";
            break;
          case error.TIMEOUT:
            message = "Location request timed out";
            break;
        }
        reject(new Error(message));
      },
    );
  });
}

/**
 * Geocode multiple addresses with rate limiting and error handling
 * Updates addresses in place with location and formatted address
 */
export async function geocodeAddresses(
  addresses: Address[],
  apiKey: string,
  userLocation?: GeoPoint,
): Promise<Address[]> {
  const results: Address[] = [];

  for (const addr of addresses) {
    try {
      const result = await geocodeAddress(
        addr.originalText,
        apiKey,
        userLocation,
      );

      results.push({
        ...addr,
        location: result?.position,
        formattedAddress: result?.address,
        isGeocoding: false,
      });
    } catch (err: any) {
      // If rate limit error, propagate it to stop processing
      if (err.message && err.message.includes("Rate limit")) {
        throw err;
      }

      // For other errors, just log and mark as failed
      console.error(`Geocoding error for ${addr.originalText}`, err);
      results.push({
        ...addr,
        isGeocoding: false,
      });
    }
  }

  return results;
}
