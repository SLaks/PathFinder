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
  Alert,
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
  getTransitMode,
  setTransitMode as saveTransitMode,
} from "./services/storageService";
import { getUserLocation, geocodeAddresses } from "./services/locationService";
import { optimizeRoute } from "./services/routeService";
import { separateAddressesByStatus } from "./services/addressService";
import { HereAction } from "./services/hereService";
import { DEFAULT_TRANSIT_MODE } from "./utils/transitModes";
import { mdiAlert } from "@mdi/js";
import Icon from "@mdi/react";

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
  const [routeActions, setRouteActions] = useState<HereAction[]>([]);
  const [focusedAddressId, setFocusedAddressId] = useState<string | null>(null);
  const [hoveredAddressId, setHoveredAddressId] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<HereAction | null>(null);
  const [transitMode, setTransitMode] =
    useState<TransitMode>(DEFAULT_TRANSIT_MODE);

  const isMobile = useMediaQuery("(max-width: 768px)");

  // Load API Key from storage
  useEffect(() => {
    // Check URL parameters first
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get("here_api_key");

    if (urlKey) {
      setApiKey(urlKey);
      saveHereApiKey(urlKey);

      // Remove query param from URL without reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    } else {
      const storedKey = getHereApiKey();
      if (storedKey) {
        setApiKey(storedKey);
      }
      setShowKeyModal(!storedKey);
    }

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
      const {
        sortedAddresses,
        routeShape: shape,
        actions,
      } = await optimizeRoute(userLocation, active, apiKey, transitMode);

      // Update state with sorted order, appending completed ones at the end
      setAddresses([...sortedAddresses, ...completed]);
      setRouteShape(shape);
      setRouteActions(actions);

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
    // Don't clear immediately, just open the modal to allow editing/viewing
    setKeyInput(apiKey);
    setShowKeyModal(true);
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
      routeActions={routeActions}
      onHoverAction={setHoveredAction}
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
        onClose={() => {
          if (apiKey) setShowKeyModal(false);
        }}
        withCloseButton={!!apiKey}
        centered
        title="HERE Maps API Key"
        closeOnClickOutside={!!apiKey}
        closeOnEscape={!!apiKey}
        size="md"
      >
        <Stack>
          <Text size="sm" c="dimmed" style={{ textAlign: "justify" }}>
            This application uses HERE Maps for geocoding, mapping, and route
            optimization. Need a key? Get a free key from{" "}
            <Anchor
              href="https://platform.here.com/portal/sign-up"
              target="_blank"
              rel="noreferrer"
            >
              platform.here.com
            </Anchor>{" "}
            (requires payment information, but includes a generous free tier).
          </Text>

          {apiKey && (
            <Stack
              gap="xs"
              p="xs"
              bg={colorScheme === "dark" ? "dark.6" : "gray.0"}
              style={{
                borderRadius: "var(--mantine-radius-sm)",
                textAlign: "justify",
              }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Shareable Link
              </Text>
              <Text size="xs">Share this link to pre-fill your API key.</Text>
              <Alert
                title="Warning"
                variant="light"
                color="red"
                icon={<Icon path={mdiAlert} size={0.8} />}
              >
                This link includes your Here API key, which is linked to your
                payment details. Only share this link with people you trust.
              </Alert>
              <Flex gap="xs">
                <TextInput
                  flex={1}
                  size="xs"
                  readOnly
                  value={`${window.location.origin}${window.location.pathname}?here_api_key=${apiKey}`}
                />
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}${window.location.pathname}?here_api_key=${apiKey}`,
                    );
                  }}
                >
                  Copy
                </Button>
              </Flex>
            </Stack>
          )}

          <TextInput
            label={apiKey && "API Key"}
            placeholder="Paste your API Key here"
            value={keyInput}
            onChange={(e) => setKeyInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveKey(keyInput);
            }}
          />
          <Button onClick={() => handleSaveKey(keyInput)} fullWidth>
            {apiKey ? "Save" : "Start App"}
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            Your key is stored locally in your browser.
          </Text>
          <Text size="xs" c="dimmed" ta="center">
            <a href="/privacy.html" target="_blank" rel="noopener">
              Privacy Policy
            </a>
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
            hoveredAction={hoveredAction}
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
