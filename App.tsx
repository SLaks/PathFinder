import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Button,
  Text,
  Anchor,
  Box,
  Flex,
  Stack,
  useMantineColorScheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import HereMap from "./components/HereMap";
import Sidebar from "./components/Sidebar";
import { BottomSheet } from "./components/BottomSheet";
import { DarkModeToggle } from "./components/DarkModeToggle";
import { Address, GeoPoint, TransitMode } from "./types";
import {
  getHereApiKey,
  setHereApiKey as saveHereApiKey,
  removeHereApiKey,
  getTransitMode,
  setTransitMode as saveTransitMode,
} from "./services/storageService";
import { getUserLocation, geocodeAddresses } from "./services/locationService";
import { optimizeRoute } from "./services/routeService";
import { separateAddressesByStatus } from "./services/addressService";
import { DEFAULT_TRANSIT_MODE } from "./utils/transitModes";

const App: React.FC = () => {
  const { colorScheme } = useMantineColorScheme();
  const [apiKey, setApiKey] = useState<string>("");
  const [keyInput, setKeyInput] = useState<string>("");
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [routeShape, setRouteShape] = useState<string[]>([]);
  const [focusedAddressId, setFocusedAddressId] = useState<string | null>(null);
  const [hoveredAddressId, setHoveredAddressId] = useState<string | null>(null);
  const [transitMode, setTransitMode] =
    useState<TransitMode>(DEFAULT_TRANSIT_MODE);

  const isMobile = useMediaQuery("(max-width: 768px)");

  // Load API Key from storage
  useEffect(() => {
    const storedKey = getHereApiKey();
    if (storedKey) {
      setApiKey(storedKey);
    }
    setShowKeyModal(!storedKey);

    // Load transit mode from storage
    const storedMode = getTransitMode();
    if (storedMode) {
      setTransitMode(storedMode);
    }
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
        transitMode,
      );

      // Update state with sorted order, appending completed ones at the end
      setAddresses([...sortedAddresses, ...completed]);
      setRouteShape(shape);

      // No need to switch tabs anymore, map is always visible
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
    setKeyInput("");
    setShowKeyModal(true);
    setAddresses([]);
    setRouteShape([]);
  };

  const sidebarContent = (
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
      transitMode={transitMode}
      onTransitModeChange={(mode: TransitMode) => {
        setTransitMode(mode);
        saveTransitMode(mode);
      }}
    />
  );

  return (
    <Flex
      id="app-root"
      direction="column"
      h="100vh"
      w="100vw"
      bg={colorScheme === "dark" ? "dark.8" : "gray.1"}
      style={{ overflow: "hidden" }}
    >
      {/* API Key Modal */}
      <Modal
        opened={showKeyModal}
        onClose={() => {}}
        withCloseButton={false}
        centered
        title="Enter HERE Maps API Key"
        closeOnClickOutside={false}
        closeOnEscape={false}
        size="md"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            This application uses HERE Maps for geocoding, mapping, and route
            optimization. You can get a free Freemium key from{" "}
            <Anchor
              href="https://platform.here.com/"
              target="_blank"
              rel="noreferrer"
            >
              developer.here.com
            </Anchor>
            .
          </Text>
          <TextInput
            placeholder="Paste your API Key here"
            value={keyInput}
            onChange={(e) => setKeyInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveKey(keyInput);
            }}
          />
          <Button onClick={() => handleSaveKey(keyInput)} fullWidth>
            Start App
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            Your key is stored locally in your browser.
          </Text>
        </Stack>
      </Modal>

      {/* Main Content Area */}
      <Flex flex={1} style={{ position: "relative", overflow: "hidden" }}>
        {/* Sidebar Container - Desktop */}
        {!isMobile && (
          <Box
            id="sidebar-container"
            w={384}
            h="100%"
            style={{
              zIndex: 20,
            }}
          >
            {sidebarContent}
          </Box>
        )}

        {/* Map Container */}
        <Box
          id="map-container"
          flex={1}
          h="100%"
          style={{
            position: "relative",
          }}
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
            <Box
              className="print-hidden"
              pos="absolute"
              top={16}
              right={16}
              bg={colorScheme === "dark" ? "yellow.9" : "yellow.1"}
              c={colorScheme === "dark" ? "yellow.1" : "yellow.9"}
              px="md"
              py="xs"
              style={{
                borderRadius: "var(--mantine-radius-md)",
                zIndex: 10,
                boxShadow: "var(--mantine-shadow-sm)",
              }}
            >
              Waiting for location...
            </Box>
          )}
          <Box
            className="print-hidden"
            pos="absolute"
            top={16}
            left={16}
            style={{ zIndex: 10 }}
          >
            <DarkModeToggle />
          </Box>
        </Box>
      </Flex>

      {/* Mobile Bottom Sheet */}
      {isMobile && <BottomSheet minHeight={60}>{sidebarContent}</BottomSheet>}
    </Flex>
  );
};

export default App;
