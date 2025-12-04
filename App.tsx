import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Button,
  Text,
  Anchor,
  Box,
  Flex,
  Group,
  Stack,
  UnstyledButton,
  rem,
  useMantineColorScheme,
} from "@mantine/core";
import HereMap from "./components/HereMap";
import Sidebar from "./components/Sidebar";
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

  // Mobile UI State
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");

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
    setKeyInput("");
    setShowKeyModal(true);
    setAddresses([]);
    setRouteShape([]);
  };

  return (
    <Flex
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
        {/* Sidebar Container */}
        <Box
          w={{ base: "100%", md: 384 }}
          h="100%"
          style={{
            zIndex: 20,
          }}
          display={{
            base: mobileTab === "list" ? "block" : "none",
            md: "block",
          }}
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
            transitMode={transitMode}
            onTransitModeChange={(mode: TransitMode) => {
              setTransitMode(mode);
              saveTransitMode(mode);
            }}
          />
        </Box>

        {/* Map Container */}
        <Box
          flex={1}
          h="100%"
          style={{
            position: "relative",
          }}
          display={{
            base: mobileTab === "map" ? "block" : "none",
            md: "block",
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
          <Box pos="absolute" top={16} left={16} style={{ zIndex: 10 }}>
            <DarkModeToggle />
          </Box>
        </Box>
      </Flex>

      {/* Mobile Bottom Navigation */}
      <Group
        hiddenFrom="md"
        h={64}
        bg={colorScheme === "dark" ? "dark.6" : "white"}
        style={{
          borderTop:
            colorScheme === "dark"
              ? "1px solid var(--mantine-color-dark-4)"
              : "1px solid var(--mantine-color-gray-3)",
          flexShrink: 0,
          zIndex: 30,
          boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
        }}
        gap={0}
      >
        <UnstyledButton
          flex={1}
          h="100%"
          c={mobileTab === "list" ? "blue" : "gray.6"}
          onClick={() => setMobileTab("list")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: rem(4),
          }}
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
          <Text size="xs" fw={500}>
            Addresses
          </Text>
        </UnstyledButton>
        <UnstyledButton
          flex={1}
          h="100%"
          c={mobileTab === "map" ? "blue" : "gray.6"}
          onClick={() => setMobileTab("map")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: rem(4),
          }}
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
          <Text size="xs" fw={500}>
            Map
          </Text>
        </UnstyledButton>
      </Group>
    </Flex>
  );
};

export default App;
