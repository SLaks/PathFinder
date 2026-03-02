import React from "react";
import {
  Stack,
  Group,
  Box,
  Text,
  Button,
  ActionIcon,
  Textarea,
  Divider,
  Paper,
  Collapse,
  Badge,
} from "@mantine/core";
import Icon from "@mdi/react";
import { mdiSync, mdiGoogleSpreadsheet, mdiChevronDown, mdiChevronRight } from "@mdi/js";
import { SheetConfig, ImportStatus } from "../../types";

interface DataSourcePanelProps {
  colorScheme: string;
  isSourceExpanded: boolean;
  setIsSourceExpanded: (v: boolean) => void;
  sheetConfig: SheetConfig | null;
  isSyncing: boolean;
  isBusy: boolean;
  handleGoogleAction: (action: "PICK" | "SYNC") => void;
  inputText: string;
  setInputText: (v: string) => void;
  handleImport: () => void;
  importStatus: ImportStatus;
}

export const SidebarDataSourcePanel: React.FC<DataSourcePanelProps> = ({
  colorScheme,
  isSourceExpanded,
  setIsSourceExpanded,
  sheetConfig,
  isSyncing,
  isBusy,
  handleGoogleAction,
  inputText,
  setInputText,
  handleImport,
  importStatus,
}) => (
  <Stack gap="xs" className="print-hidden">
    <Text size="lg" fw={600}>
      Data Source
    </Text>
    <Paper
      withBorder
      radius="md"
      bg={colorScheme === "dark" ? "dark.6" : "gray.0"}
      style={{ overflow: "hidden" }}
    >
      {/* Header */}
      <Group
        p="xs"
        bg={colorScheme === "dark" ? "dark.7" : "white"}
        justify="space-between"
        onClick={() => setIsSourceExpanded(!isSourceExpanded)}
        wrap="nowrap"
        style={{
          cursor: "pointer",
          borderBottom: isSourceExpanded
            ? colorScheme === "dark"
              ? "1px solid var(--mantine-color-dark-4)"
              : "1px solid var(--mantine-color-gray-3)"
            : "none",
        }}
      >
        <Group gap="xs" wrap="nowrap" style={{ overflow: "hidden", flex: 1 }}>
          {!isSourceExpanded && sheetConfig ? (
            <>
              <Box style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                <Icon path={mdiGoogleSpreadsheet} size={0.8} color="green" />
              </Box>
              <Text size="sm" fw={500} truncate="end" style={{ flexShrink: 1 }}>
                {sheetConfig.spreadsheetName}
              </Text>
              {sheetConfig.sheetTitle && (
                <Text size="xs" c="dimmed" truncate="end" style={{ flexShrink: 2 }}>
                  / {sheetConfig.sheetTitle}
                </Text>
              )}
            </>
          ) : (
            <Text size="sm" c="dimmed" fw={500} truncate="end">
              {isSourceExpanded ? "Configure Import" : "No Source Selected"}
            </Text>
          )}
        </Group>
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
          {!isSourceExpanded && sheetConfig && (
            <ActionIcon
              variant="subtle"
              color="green"
              onClick={(e) => {
                e.stopPropagation();
                handleGoogleAction("SYNC");
              }}
              loading={isSyncing}
              disabled={isBusy}
            >
              <Icon path={mdiSync} size={0.8} />
            </ActionIcon>
          )}
          <ActionIcon variant="subtle" color="gray">
            <Icon path={isSourceExpanded ? mdiChevronDown : mdiChevronRight} size={0.9} />
          </ActionIcon>
        </Group>
      </Group>
      <Collapse in={isSourceExpanded}>
        <Stack p="md" gap="md">
          {/* Google Sheets */}
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs" fw={500} c="dimmed" tt="uppercase">
                Google Sheets
              </Text>
              {sheetConfig && (
                <Badge color="green" variant="light" tt="none">
                  {sheetConfig.spreadsheetName} / {sheetConfig.sheetTitle}
                </Badge>
              )}
            </Group>
            {sheetConfig?.columnMapping?.statusColumnName && (
              <Text size="xs" c="dimmed">
                Checkboxes sync to the <Text span fw={500} c="emerald">{sheetConfig.columnMapping.statusColumnName}</Text> column
              </Text>
            )}
            {sheetConfig ? (
              <Group gap="xs">
                <Button
                  flex={1}
                  color="emerald"
                  leftSection={<Icon path={mdiSync} size={0.8} spin={isSyncing} />}
                  onClick={() => handleGoogleAction("SYNC")}
                  loading={isSyncing}
                  disabled={isBusy}
                >
                  Sync Sheet
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleGoogleAction("PICK")}
                  disabled={isBusy}
                >
                  Change
                </Button>
              </Group>
            ) : (
              <Button
                variant="default"
                leftSection={<Icon path={mdiGoogleSpreadsheet} size={0.8} color="green" />}
                onClick={() => handleGoogleAction("PICK")}
                disabled={isBusy}
                fullWidth
              >
                Connect Google Sheet
              </Button>
            )}
          </Stack>
          <Divider label="Or" labelPosition="center" />
          {/* Paste Text */}
          <Stack gap="xs">
            <Text size="xs" fw={500} c="dimmed" tt="uppercase">
              Paste Text
            </Text>
            <Textarea
              placeholder="Paste addresses here (e.g. Name | Address)..."
              minRows={4}
              value={inputText}
              onChange={(e) => setInputText(e.currentTarget.value)}
              disabled={isBusy}
            />
            <Group justify="space-between">
              <Button
                size="sm"
                color="emerald"
                onClick={handleImport}
                loading={importStatus === ImportStatus.PARSING}
                disabled={isBusy || !inputText}
              >
                Parse Text
              </Button>
              {importStatus === ImportStatus.SUCCESS && (
                <Text size="xs" c="green" fw={500}>
                  Imported!
                </Text>
              )}
              {importStatus === ImportStatus.ERROR && (
                <Text size="xs" c="red" fw={500}>
                  Failed.
                </Text>
              )}
            </Group>
          </Stack>
        </Stack>
      </Collapse>
    </Paper>
  </Stack>
);
