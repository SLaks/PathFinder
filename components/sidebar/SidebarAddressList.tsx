import React from "react";
import { Stack, Group, Box, Text, Button, Divider } from "@mantine/core";
import { Address, SheetConfig } from "../../types";
import { AddressCard } from "../AddressCard";

interface SidebarAddressListProps {
  colorScheme: string;
  addresses: Address[];
  setAddresses: (a: Address[]) => void;
  isBusy: boolean;
  onFocusAddress: (id: string) => void;
  onHoverAddress: (id: string | null) => void;
  handleToggleComplete: (id: string, completed: boolean) => void;
  sheetConfig: SheetConfig| null;
  onEditRow: (address: Address) => void;
}

export const SidebarAddressList: React.FC<SidebarAddressListProps> = ({
  colorScheme,
  addresses,
  setAddresses,
  isBusy,
  onFocusAddress,
  onHoverAddress,
  handleToggleComplete,
  sheetConfig,
  onEditRow,
}) => {
  const pendingAddresses = addresses.filter((a) => !a.completed);
  const completedAddresses = addresses.filter((a) => a.completed);

  return (
    <Stack gap="xs">
      <Group justify="space-between" className="print-hidden">
        <Text size="lg" fw={600}>
          Address List
        </Text>
        {addresses.length > 0 && (
          <Button
            variant="subtle"
            color="red"
            size="xs"
            onClick={() => setAddresses([])}
            disabled={isBusy}
          >
            Clear
          </Button>
        )}
      </Group>
      {addresses.length === 0 && (
        <Box
          p="xl"
          style={{
            border:
              colorScheme === "dark"
                ? "2px dashed var(--mantine-color-dark-4)"
                : "2px dashed var(--mantine-color-gray-3)",
            borderRadius: "var(--mantine-radius-md)",
            textAlign: "center",
          }}
        >
          <Text size="sm" c="dimmed">
            No addresses added yet.
          </Text>
        </Box>
      )}
      <Stack gap="xs">
        {pendingAddresses.map((addr, idx) => (
          <AddressCard
            key={addr.id}
            address={addr}
            index={idx}
            onClick={() => onFocusAddress(addr.id)}
            onMouseEnter={() => onHoverAddress(addr.id)}
            onMouseLeave={() => onHoverAddress(null)}
            className="p-3"
            disabled={isBusy}
            onToggleComplete={(val) => handleToggleComplete(addr.id, val)}
            statusColumnName={sheetConfig?.columnMapping?.statusColumnName}
            onEditRow={() => onEditRow(addr)}
          />
        ))}
      </Stack>
      {completedAddresses.length > 0 && (
        <div className="print-hidden">
          <Divider label="Completed" labelPosition="left" />
          <Stack gap="xs" style={{ opacity: 0.6, filter: "grayscale(100%)" }}>
            {completedAddresses.map((addr, idx) => (
              <AddressCard
                key={addr.id}
                address={addr}
                index={idx + pendingAddresses.length}
                onClick={() => onFocusAddress(addr.id)}
                onMouseEnter={() => onHoverAddress(addr.id)}
                onMouseLeave={() => onHoverAddress(null)}
                className="p-3"
                disabled={isBusy}
                onToggleComplete={(val) => handleToggleComplete(addr.id, val)}
                statusColumnName={sheetConfig?.columnMapping?.statusColumnName}
                onEditRow={() => onEditRow(addr)}
              />
            ))}
          </Stack>
        </div>
      )}
    </Stack>
  );
};
