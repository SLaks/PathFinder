import React from "react";
import {
  Paper,
  Group,
  Stack,
  Text,
  Checkbox,
  Loader,
  Box,
} from "@mantine/core";
import { Address } from "../types";
import { getAddressColor } from "../utils/colors";
import { getInitials } from "../utils/formatters";

export interface AddressCardProps {
  address: Address;
  index: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
  isCompact?: boolean; // For map bubble
  disabled?: boolean;
  onToggleComplete?: (completed: boolean) => void;
}

export const AddressCard: React.FC<AddressCardProps> = ({
  address,
  index,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className = "",
  isCompact = false,
  disabled = false,
  onToggleComplete,
}) => {
  const color = getAddressColor(index);
  const initials = getInitials(address.name || address.originalText);
  const isLoading = address.isGeocoding;
  const isError = !address.location && !address.isGeocoding;

  return (
    <Paper
      withBorder={!isCompact}
      p={isCompact ? 0 : "sm"}
      radius="md"
      className={className}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={!disabled ? onMouseEnter : undefined}
      onMouseLeave={!disabled ? onMouseLeave : undefined}
      style={{
        cursor: disabled ? "default" : onClick ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
        backgroundColor: isError
          ? "var(--mantine-color-red-0)"
          : isLoading
            ? "var(--mantine-color-blue-0)"
            : undefined,
        borderColor: isError
          ? "var(--mantine-color-red-2)"
          : isLoading
            ? "var(--mantine-color-blue-2)"
            : undefined,
        transition: "all 0.2s ease",
      }}
    >
      <Group align="flex-start" wrap="nowrap" gap="sm">
        {!isCompact && onToggleComplete && (
          <Checkbox
            checked={!!address.completed}
            onChange={(e) => onToggleComplete(e.currentTarget.checked)}
            disabled={disabled}
            onClick={(e) => e.stopPropagation()}
            mt={4}
          />
        )}

        <Stack align="center" gap={4} w={32}>
          <Box
            w={32}
            h={32}
            style={{
              borderRadius: "50%",
              backgroundColor: isLoading
                ? "var(--mantine-color-gray-4)"
                : color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "bold",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {isLoading ? <Loader size={16} color="white" /> : initials}
          </Box>
          <Text size="xs" fw={700} c={address.completed ? "green" : "dimmed"}>
            {address.completed ? "✓" : `#${address.sequenceOrder ?? index + 1}`}
          </Text>
        </Stack>

        <Stack gap={2} style={{ flex: 1, minWidth: 128 }}>
          {address.name && (
            <Text size="sm" fw={700} truncate>
              {address.name}
            </Text>
          )}
          <Text
            size={address.name ? "xs" : "sm"}
            fw={address.name ? 400 : 500}
            c={address.name ? "dimmed" : "black"}
            style={{ whiteSpace: "pre-wrap" }}
          >
            {address.formattedAddress || address.originalText}
          </Text>
          {isLoading && (
            <Text size="xs" c="blue">
              Finding location...
            </Text>
          )}
          {isError && (
            <Text size="xs" c="red">
              Location not found
            </Text>
          )}
        </Stack>
      </Group>
    </Paper>
  );
};
