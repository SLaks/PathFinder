import React from "react";
import {
  Paper,
  Group,
  Stack,
  Text,
  Checkbox,
  Loader,
  Box,
  useMantineColorScheme,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import Icon from "@mdi/react";
import { mdiPlaylistEdit } from "@mdi/js";
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
  statusColumnName?: string;
  onEditRow?: () => void;
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
  statusColumnName,
  onEditRow,
}) => {
  const { colorScheme } = useMantineColorScheme();
  const color = getAddressColor(index);
  const initials = getInitials(address.name || address.originalText);
  const isLoading = address.isGeocoding;
  const isError = !address.location && !address.isGeocoding;

  return (
    <Paper
      withBorder={!isCompact}
      p={isCompact ? 0 : "sm"}
      radius="md"
      shadow={isCompact ? "none" : "sm"}
      className={className}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={!disabled ? onMouseEnter : undefined}
      onMouseLeave={!disabled ? onMouseLeave : undefined}
      style={{
        cursor: disabled ? "default" : onClick ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
        backgroundColor: isError
          ? colorScheme === "dark"
            ? "var(--mantine-color-red-9)"
            : "var(--mantine-color-red-0)"
          : isLoading
            ? colorScheme === "dark"
              ? "var(--mantine-color-emerald-9)"
              : "var(--mantine-color-emerald-0)"
            : "transparent", // We use a custom color for bubble backgrounds.
        borderColor: isError
          ? colorScheme === "dark"
            ? "var(--mantine-color-red-7)"
            : "var(--mantine-color-red-2)"
          : isLoading
            ? colorScheme === "dark"
              ? "var(--mantine-color-emerald-7)"
              : "var(--mantine-color-emerald-2)"
            : undefined,
        transition: "all 0.2s ease",
      }}
    >
      <Group align="flex-start" wrap="nowrap" gap="sm">
        {!isCompact && onToggleComplete && (
          <Tooltip
            label={`Updates column: ${statusColumnName}`}
            disabled={!statusColumnName}
            withArrow
            className="print-hidden"
          >
            <Checkbox
              checked={!!address.completed}
              onChange={(e) => onToggleComplete(e.currentTarget.checked)}
              disabled={disabled}
              onClick={(e) => e.stopPropagation()}
              mt={4}
            />
          </Tooltip>
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
              "-webkit-print-color-adjust": "exact",
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
            <Text size="xs" c="emerald">
              Finding location...
            </Text>
          )}
          {isError && (
            <Text size="xs" c="red">
              Location not found
            </Text>
          )}
        </Stack>

        {!isCompact && address.headers && (
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={(e) => {
              e.stopPropagation();
              onEditRow?.();
            }}
            disabled={disabled}
            className="print-hidden"
            title="Edit spreadsheet data"
          >
            <Icon path={mdiPlaylistEdit} size={0.8} />
          </ActionIcon>
        )}
      </Group>
    </Paper>
  );
};
