import React from "react";
import { Box, Stack, Group, Button, Text, Menu } from "@mantine/core";
import Icon from "@mdi/react";
import { TRANSIT_MODES } from "../../utils/transitModes";
import { Address, GeoPoint, TransitMode } from "@/types";

interface SidebarFooterProps {
  colorScheme: string;
  isGeocoding: boolean;
  isOptimizing: boolean;
  addresses: Address[];
  userLocation: GeoPoint | null;
  transitMode: TransitMode;
  onTransitModeChange: (mode: TransitMode) => void;
  onOptimize: () => void;
  getGoogleMapsLink: () => string;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  colorScheme,
  isGeocoding,
  isOptimizing,
  addresses,
  userLocation,
  transitMode,
  onTransitModeChange,
  onOptimize,
  getGoogleMapsLink,
}) => (
  <Box
    p="md"
    bg={colorScheme === "dark" ? "dark.6" : "gray.0"}
    style={{
      borderTop:
        colorScheme === "dark"
          ? "1px solid var(--mantine-color-dark-4)"
          : "1px solid var(--mantine-color-gray-3)",
    }}
    className="print-hidden"
  >
    <Stack gap="sm">
      {isGeocoding && (
        <Text size="xs" c="emerald" ta="center">
          Geocoding addresses...
        </Text>
      )}
      <Group gap="xs">
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button
              variant="default"
              size="md"
              disabled={isGeocoding || isOptimizing}
              leftSection={
                <Icon
                  path={
                    TRANSIT_MODES.find((m) => m.mode === transitMode)?.icon ||
                    TRANSIT_MODES[0].icon
                  }
                  size={0.8}
                />
              }
            >
              {TRANSIT_MODES.find((m) => m.mode === transitMode)?.label ||
                "Car"}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Transit Mode</Menu.Label>
            {TRANSIT_MODES.map((mode) => (
              <Menu.Item
                key={mode.mode}
                leftSection={<Icon path={mode.icon} size={0.7} />}
                onClick={() => onTransitModeChange(mode.mode)}
                bg={
                  mode.mode === transitMode
                    ? colorScheme === "dark"
                      ? "dark.5"
                      : "gray.1"
                    : undefined
                }
              >
                {mode.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        <Button
          flex={1}
          size="md"
          onClick={onOptimize}
          loading={isOptimizing}
          disabled={isGeocoding || addresses.length < 2 || !userLocation}
        >
          Optimize Route
        </Button>
      </Group>
      {addresses.some((a) => a.sequenceOrder) && (
        <Button
          component="a"
          href={getGoogleMapsLink()}
          target="_blank"
          variant="outline"
          color="gray"
          fullWidth
        >
          Start Navigation in Google Maps
        </Button>
      )}
    </Stack>
  </Box>
);
