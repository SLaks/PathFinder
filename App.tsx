import React, { useState, useEffect } from "react";
import HereMap from "./components/HereMap";
import Sidebar from "./components/Sidebar";
import { Address, GeoPoint } from "./types";
import {
  getHereApiKey,
  setHereApiKey as saveHereApiKey,
  removeHereApiKey,
} from "./services/storageService";
import { getUserLocation, geocodeAddresses } from "./services/locationService";
import { optimizeRoute } from "./services/routeService";
import { separateAddressesByStatus } from "./services/addressService";

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>("");
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [routeShape, setRouteShape] = useState<string[]>([]);
  const [focusedAddressId, setFocusedAddressId] = useState<string | null>(null);
  const [hoveredAddressId, setHoveredAddressId] = useState<string | null>(null);

  // Mobile UI State
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");

  // Load API Key from storage
  useEffect(() => {
    const storedKey = getHereApiKey();
    if (storedKey) {
      setApiKey(storedKey);
    }
    setShowKeyModal(!storedKey);
  }, []);

  // Get user location on mount
  useEffect(() => {
    getUserLocation()
      .then((location) => {
        setUserLocation(location);
      })
      .catch((error) => {
        console.error("Error getting location", error);
        // Optionally show a toast/notification instead of alert
      });
  }, []);

  // Geocode addresses when they are added (if they don't have location)
  useEffect(() => {
    const geocodePending = async () => {
      if (!apiKey || isGeocoding) return;

      // Find addresses that are marked as loading but don't have a location yet
      const pendingAddresses = addresses.filter(
        (a) => a.isGeocoding && !a.location,
      );
      if (pendingAddresses.length === 0) return;

      setIsGeocoding(true);

      try {
        const geocodedAddresses = await geocodeAddresses(
          pendingAddresses,
          apiKey,
          userLocation || undefined,
        );

        // Update addresses with geocoded results
        setAddresses((prev) =>
          prev.map((a) => {
            const updated = geocodedAddresses.find((ga) => ga.id === a.id);
            return updated || a;
          }),
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "An error occurred";
        alert(message);
      } finally {
        setIsGeocoding(false);
      }
    };

    geocodePending();
  }, [addresses, apiKey, isGeocoding, userLocation]);

  const handleOptimize = async () => {
    if (!userLocation || !apiKey) return;
    setIsOptimizing(true);

    try {
      // Separate active and completed addresses
      const { active, completed } = separateAddressesByStatus(addresses);

      // Optimize route for active addresses only
      const { sortedAddresses, routeShape: shape } = await optimizeRoute(
        userLocation,
        active,
        apiKey,
      );

      // Update state with sorted order, appending completed ones at the end
      setAddresses([...sortedAddresses, ...completed]);
      setRouteShape(shape);

      // Switch to map view on mobile so user can see result
      setMobileTab("map");
    } catch (error: unknown) {
      console.error("Optimization failed", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not optimize route. Please check your API Key and try again.";
      alert(errorMessage);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveKey = (key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      setApiKey(trimmed);
      saveHereApiKey(trimmed);
      setShowKeyModal(false);
    }
  };

  const handleResetKey = () => {
    removeHereApiKey();
    setApiKey("");
    setShowKeyModal(true);
    setAddresses([]);
    setRouteShape([]);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100 overflow-hidden">
      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm px-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-2 text-gray-900">
              Enter HERE Maps API Key
            </h2>
            <p className="text-gray-600 mb-6 text-sm">
              This application uses HERE Maps for geocoding, mapping, and route
              optimization. You can get a free Freemium key from{" "}
              <a
                href="https://platform.here.com/"
                target="_blank"
                className="text-blue-600 underline"
                rel="noreferrer"
              >
                developer.here.com
              </a>
              .
            </p>
            <input
              type="text"
              placeholder="Paste your API Key here"
              className="w-full bg-slate-800 text-white placeholder-gray-400 border border-slate-700 p-3 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  handleSaveKey((e.target as HTMLInputElement).value);
              }}
            />
            <button
              onClick={(e) => {
                // Simple hack to find the input value without controlled state for this simple modal
                const input = e.currentTarget
                  .previousElementSibling as HTMLInputElement;
                handleSaveKey(input.value);
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start App
            </button>
            <div className="mt-4 text-xs text-gray-400 text-center">
              Your key is stored locally in your browser.
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Sidebar Container */}
        <div
          className={`w-full md:w-96 bg-white z-20 h-full flex-shrink-0 flex flex-col ${
            mobileTab === "list" ? "block" : "hidden md:block"
          }`}
        >
          <Sidebar
            addresses={addresses}
            setAddresses={setAddresses}
            onOptimize={handleOptimize}
            isOptimizing={isOptimizing}
            isGeocoding={isGeocoding}
            userLocation={userLocation}
            onResetKey={handleResetKey}
            onFocusAddress={setFocusedAddressId}
            onHoverAddress={setHoveredAddressId}
          />
        </div>

        {/* Map Container */}
        <div
          className={`flex-1 h-full relative ${
            mobileTab === "map" ? "block" : "hidden md:block"
          }`}
        >
          <HereMap
            apiKey={apiKey}
            userLocation={userLocation}
            addresses={addresses}
            routeShape={routeShape}
            focusedAddressId={focusedAddressId}
            hoveredAddressId={hoveredAddressId}
          />
          {!userLocation && !showKeyModal && (
            <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md text-sm font-medium shadow-sm z-10">
              Waiting for location...
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden bg-white border-t border-gray-200 flex h-16 shrink-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setMobileTab("list")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
            mobileTab === "list"
              ? "text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          Addresses
        </button>
        <button
          onClick={() => setMobileTab("map")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
            mobileTab === "map"
              ? "text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
          </svg>
          Map
        </button>
      </div>
    </div>
  );
};

export default App;
