import React from "react";
import { Modal, Stack, Text, ScrollArea, UnstyledButton, Group, Button } from "@mantine/core";
import Icon from "@mdi/react";
import { mdiChevronRight } from "@mdi/js";
import { SheetInfo } from "../../services/googleSheetService";

interface SidebarSheetSelectionModalProps {
  isOpen: boolean;
  sheets: SheetInfo[];
  pendingSpreadsheetName: string;
  onClose: () => void;
  onSelect: (sheet: SheetInfo) => void;
}

export const SidebarSheetSelectionModal: React.FC<SidebarSheetSelectionModalProps> = ({
  isOpen,
  sheets,
  pendingSpreadsheetName,
  onClose,
  onSelect,
}) => (
  <Modal opened={isOpen} onClose={onClose} title="Select Sheet">
    <Stack>
      <Text size="xs" c="dimmed">
        {pendingSpreadsheetName}
      </Text>
      <ScrollArea.Autosize mah={200}>
        <Stack gap={0}>
          {sheets.map((sheet) => (
            <UnstyledButton
              key={sheet.id}
              p="sm"
              onClick={() => onSelect(sheet)}
              style={{ borderRadius: "var(--mantine-radius-sm)" }}
              className="hover:bg-emerald-50"
            >
              <Group justify="space-between">
                <Text size="sm">{sheet.title}</Text>
                <Icon path={mdiChevronRight} size={0.6} color="gray" />
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea.Autosize>
      <Button variant="subtle" color="gray" onClick={onClose}>
        Cancel
      </Button>
    </Stack>
  </Modal>
);
