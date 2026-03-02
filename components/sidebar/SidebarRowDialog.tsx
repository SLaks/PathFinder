import React, { useState } from "react";
import {
  Modal,
  Button,
  Table,
  TextInput,
  Checkbox,
  Stack,
  Group,
  Text,
  ScrollArea,
} from "@mantine/core";
import { Address } from "../../types";

interface SidebarRowDialogProps {
  opened: boolean;
  onClose: () => void;
  address: Address | null;
  onSave: (newData: string[]) => void;
  isSaving: boolean;
}

export const SidebarRowDialog: React.FC<SidebarRowDialogProps> = ({
  opened,
  onClose,
  address,
  onSave,
  isSaving,
}) => {
  const [editedData, setEditedData] = useState<string[]>([
    ...(address?.fullRowData || []),
  ]);
  const [hasChanges, setHasChanges] = useState(false);

  const handleValueChange = (index: number, value: string) => {
    const newData = [...editedData];
    newData[index] = value;
    setEditedData(newData);
    setHasChanges(
      JSON.stringify(newData) !== JSON.stringify(address?.fullRowData),
    );
  };

  const handleSave = () => {
    onSave(editedData);
  };

  if (!address || !address.headers || !address.fullRowData) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700}>Edit Row: {address.name || address.originalText}</Text>
      }
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="md">
        <Table withTableBorder withColumnBorders>
          <Table.Tbody>
            {address.headers.map((header, idx) => {
              const value = editedData[idx] || "";
              const isBoolean =
                value.toUpperCase() === "TRUE" ||
                value.toUpperCase() === "FALSE" ||
                header.toLowerCase().includes("status") ||
                header.toLowerCase().includes("complete");

              return (
                <Table.Tr key={idx}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {header}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {isBoolean ? (
                      <Checkbox
                        checked={value.toUpperCase() === "TRUE"}
                        onChange={(e) =>
                          handleValueChange(
                            idx,
                            e.currentTarget.checked ? "TRUE" : "FALSE",
                          )
                        }
                      />
                    ) : (
                      <TextInput
                        value={value}
                        onChange={(e) =>
                          handleValueChange(idx, e.currentTarget.value)
                        }
                        size="xs"
                      />
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={!hasChanges}
            color="emerald"
          >
            Save Changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
