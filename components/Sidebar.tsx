import React, { useState, useCallback, useEffect } from "react";
import Icon from "@mdi/react";
import {
  mdiSync,
  mdiChevronDown,
  mdiChevronRight,
  mdiGoogleSpreadsheet,
} from "@mdi/js";
import {
  Stack,
  Group,
  Box,
  Text,
  Button,
  ActionIcon,
  Textarea,
  ScrollArea,
  Collapse,
  Modal,
  Badge,
  Divider,
  Title,
  Paper,
  UnstyledButton,
  useMantineColorScheme,
  Menu,
  Tabs,
  Timeline,
} from "@mantine/core";
import {
  Address,
  GeoPoint,
  ImportStatus,
  SheetConfig,
  TransitMode,
} from "../types";
import { HereAction } from "../services/hereService";
import { parseAddressesFromText } from "../services/addressService";
import {
  getSheetConfig,
  setSheetConfig as saveSheetConfig,
} from "../services/storageService";
import {
  initializeGoogleSheets,
  pickSheet,
  syncSheetData,
  updateSheetStatus,
  selectAndSyncSheet,
  SheetPickerResult,
  SheetSyncResult,
} from "../services/sheetIntegrationService";
import { SheetInfo } from "../services/googleSheetService";
import { createGoogleMapsNavigationLink } from "../services/routeService";
import { AddressCard } from "./AddressCard";
import { TRANSIT_MODES } from "../utils/transitModes";

export interface SidebarProps {
  addresses: Address[];
  setAddresses: React.Dispatch<React.SetStateAction<Address[]>>;
  onOptimize: () => void;
  isOptimizing: boolean;
  isGeocoding: boolean;
  userLocation: GeoPoint | null;
  onResetKey: () => void;
  onFocusAddress: (id: string) => void;
  onHoverAddress: (id: string | null) => void;
  transitMode: TransitMode;
  onTransitModeChange: (mode: TransitMode) => void;
  routeActions?: HereAction[];
  onHoverAction?: (action: HereAction | null) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  addresses,
  setAddresses,
  onOptimize,
  isOptimizing,
  isGeocoding,
  userLocation,
  onResetKey,
  onFocusAddress,
  onHoverAddress,
  transitMode,
  onTransitModeChange,
  routeActions = [],
  onHoverAction = () => {},
}) => {
  const { colorScheme } = useMantineColorScheme();
  const [inputText, setInputText] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>(
    ImportStatus.IDLE,
  );
  const [activeTab, setActiveTab] = useState<string | null>("stops");

  // Google Sheets State
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(null);
  const [statusColumnIndex, setStatusColumnIndex] = useState<number | null>(
    null,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const isBusy =
    isOptimizing ||
    isGeocoding ||
    isSyncing ||
    importStatus === ImportStatus.PARSING;
  const [sheetSelection, setSheetSelection] = useState<{
    isOpen: boolean;
    sheets: SheetInfo[];
    pendingSpreadsheetId: string;
    pendingSpreadsheetName: string;
  }>({
    isOpen: false,
    sheets: [],
    pendingSpreadsheetId: "",
    pendingSpreadsheetName: "",
  });

  // Collapsible State
  const [isSourceExpanded, setIsSourceExpanded] = useState(true);

  // Auto-collapse when a sheet is selected (optional, can be removed if not desired)
  useEffect(() => {
    if (sheetConfig) {
      setIsSourceExpanded(false);
    }
  }, [sheetConfig]);

  // Load saved configs on mount
  useEffect(() => {
    const savedSheet = getSheetConfig();
    if (savedSheet) setSheetConfig(savedSheet);
  }, []);

  const processTextData = useCallback(
    async (text: string) => {
      setImportStatus(ImportStatus.PARSING);
      setActiveTab("stops");
      try {
        const newAddresses = await parseAddressesFromText(text);
        setAddresses(newAddresses);
        setImportStatus(ImportStatus.SUCCESS);

        // Clear status after 3 seconds
        setTimeout(() => setImportStatus(ImportStatus.IDLE), 3000);
      } catch (e) {
        console.error(e);
        setImportStatus(ImportStatus.ERROR);
      }
    },
    [setAddresses, setImportStatus],
  );

  const handleImport = useCallback(async () => {
    if (!inputText.trim()) return;
    await processTextData(inputText);
  }, [inputText, processTextData]);

  const handleGoogleAction = async (action: "PICK" | "SYNC") => {
    setIsSyncing(true);
    try {
      // Initialize and authenticate
      const token = await initializeGoogleSheets();

      let targetConfig = sheetConfig;

      // Pick file if needed
      if (action === "PICK" || !targetConfig) {
        const pickerResult: SheetPickerResult = await pickSheet(token);

        if (!pickerResult.spreadsheetId) {
          // User cancelled
          setIsSyncing(false);
          return;
        }

        if (pickerResult.requiresSheetSelection && pickerResult.sheets) {
          // Multiple sheets - show selection dialog
          setSheetSelection({
            isOpen: true,
            sheets: pickerResult.sheets,
            pendingSpreadsheetId: pickerResult.spreadsheetId,
            pendingSpreadsheetName: pickerResult.spreadsheetName || "",
          });
          setIsSyncing(false);
          return;
        }

        // Single sheet - create config
        const sheet = pickerResult.sheets![0];
        targetConfig = {
          spreadsheetId: pickerResult.spreadsheetId,
          spreadsheetName: pickerResult.spreadsheetName || "",
          sheetId: sheet.id,
          sheetTitle: sheet.title,
        };
        setSheetConfig(targetConfig);
        saveSheetConfig(targetConfig);
      }

      // Sync data
      if (targetConfig) {
        setImportStatus(ImportStatus.PARSING);
        const result = await syncSheetData(targetConfig);
        selectSheet(result);
      }
    } catch (error) {
      console.error("Google Sheet Error:", error);
      alert(
        "Failed to connect to Google Sheets. Ensure your account has access.",
      );
      setImportStatus(ImportStatus.ERROR);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSheetSelect = async (sheet: SheetInfo) => {
    setSheetSelection((prev) => ({ ...prev, isOpen: false }));
    setIsSyncing(true);

    try {
      const { pendingSpreadsheetId, pendingSpreadsheetName } = sheetSelection;

      setImportStatus(ImportStatus.PARSING);
      const result = await selectAndSyncSheet(
        pendingSpreadsheetId,
        pendingSpreadsheetName,
        sheet,
      );
      selectSheet(result);
    } catch (error) {
      console.error("Error selecting sheet:", error);
      alert("Failed to load selected sheet.");
      setImportStatus(ImportStatus.ERROR);
    } finally {
      setIsSyncing(false);
    }
  };

  const selectSheet = async (result: SheetSyncResult) => {
    setAddresses(result.addresses);
    setSheetConfig(result.config);
    setStatusColumnIndex(result.statusColumnIndex);
    setImportStatus(ImportStatus.SUCCESS);
    setActiveTab("stops");
    setTimeout(() => setImportStatus(ImportStatus.IDLE), 3000);
  };

  const getGoogleMapsLink = () => {
    if (!addresses.length) return "#";
    const nextStop = addresses[0];
    return createGoogleMapsNavigationLink(nextStop, transitMode);
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    // 1. Update local state
    setAddresses((prev) =>
      prev.map((a) => (a.id === id ? { ...a, completed } : a)),
    );

    // 2. Update Google Sheet if linked
    const addr = addresses.find((a) => a.id === id);
    if (
      addr &&
      addr.sheetRow &&
      sheetConfig &&
      statusColumnIndex !== null &&
      statusColumnIndex !== -1
    ) {
      try {
        await updateSheetStatus(
          sheetConfig,
          addr.sheetRow,
          statusColumnIndex,
          completed,
        );
      } catch (e) {
        console.error("Failed to update sheet", e);
        // Revert local state on failure? Or just alert?
        // For now, just log.
      }
    }
  };

  // Split addresses into pending and completed
  const pendingAddresses = addresses.filter((a) => !a.completed);
  const completedAddresses = addresses.filter((a) => a.completed);

  return (
    <Stack
      h="100%"
      gap={0}
      bg={colorScheme === "dark" ? "dark.7" : "white"}
      style={{
        borderRight:
          colorScheme === "dark"
            ? "1px solid var(--mantine-color-dark-4)"
            : "1px solid var(--mantine-color-gray-3)",
        boxShadow: "var(--mantine-shadow-xl)",
      }}
    >
      {/* Header */}
      <Box p="md" bg="blue.6" c="white" className="print-hidden">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={1} size="h3">
              PathFinder
            </Title>
            <Text size="sm" c="blue.1">
              Import. Plan. Navigate.
            </Text>
          </Box>
          <Button
            variant="white"
            size="xs"
            bg="white"
            c="blue.6"
            onClick={onResetKey}
            disabled={isBusy}
            style={{ opacity: isBusy ? 0.5 : 1 }}
          >
            Here Key
          </Button>
        </Group>
      </Box>

      <ScrollArea flex={1} p={0} id="address-list-container">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <Tabs.List grow>
            <Tabs.Tab value="stops">Stops ({addresses.length})</Tabs.Tab>
            <Tabs.Tab
              value="directions"
              disabled={!routeActions || routeActions.length === 0}
            >
              Directions
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="stops" p="md">
            <Stack gap="lg">
              {/* Source Selection */}
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
                    style={{
                      cursor: "pointer",
                      borderBottom: isSourceExpanded
                        ? colorScheme === "dark"
                          ? "1px solid var(--mantine-color-dark-4)"
                          : "1px solid var(--mantine-color-gray-3)"
                        : "none",
                    }}
                  >
                    <Group gap="xs" style={{ overflow: "hidden" }}>
                      {!isSourceExpanded && sheetConfig ? (
                        <>
                          <Icon
                            path={mdiGoogleSpreadsheet}
                            size={0.8}
                            color="green"
                          />
                          <Text size="sm" fw={500} truncate>
                            {sheetConfig.spreadsheetName}
                          </Text>
                          {sheetConfig.sheetTitle && (
                            <Text size="xs" c="dimmed">
                              / {sheetConfig.sheetTitle}
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text size="sm" c="dimmed" fw={500}>
                          {isSourceExpanded
                            ? "Configure Import"
                            : "No Source Selected"}
                        </Text>
                      )}
                    </Group>
                    <Group gap={4}>
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
                        <Icon
                          path={
                            isSourceExpanded ? mdiChevronDown : mdiChevronRight
                          }
                          size={0.9}
                        />
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
                              {sheetConfig.spreadsheetName} /{" "}
                              {sheetConfig.sheetTitle}
                            </Badge>
                          )}
                        </Group>
                        {sheetConfig?.columnMapping?.statusColumnName && (
                          <Text size="xs" c="dimmed">
                            Checkboxes sync to the{" "}
                            <Text span fw={500} c="blue">
                              {sheetConfig.columnMapping.statusColumnName}
                            </Text>{" "}
                            column
                          </Text>
                        )}

                        {sheetConfig ? (
                          <Group gap="xs">
                            <Button
                              flex={1}
                              color="green"
                              leftSection={
                                <Icon
                                  path={mdiSync}
                                  size={0.8}
                                  spin={isSyncing}
                                />
                              }
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
                            leftSection={
                              <Icon
                                path={mdiGoogleSpreadsheet}
                                size={0.8}
                                color="green"
                              />
                            }
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
                            color="dark"
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

              {/* List */}
              {/* List */}
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
                      onToggleComplete={(val) =>
                        handleToggleComplete(addr.id, val)
                      }
                      statusColumnName={
                        sheetConfig?.columnMapping?.statusColumnName
                      }
                    />
                  ))}
                </Stack>

                {completedAddresses.length > 0 && (
                  <div className="print-hidden">
                    <Divider label="Completed" labelPosition="left" />
                    <Stack
                      gap="xs"
                      style={{ opacity: 0.6, filter: "grayscale(100%)" }}
                    >
                      {completedAddresses.map((addr, idx) => (
                        <AddressCard
                          key={addr.id}
                          address={addr}
                          index={idx + pendingAddresses.length} // Keep index continuous? Or just hide index for completed?
                          onClick={() => onFocusAddress(addr.id)}
                          onMouseEnter={() => onHoverAddress(addr.id)}
                          onMouseLeave={() => onHoverAddress(null)}
                          className="p-3"
                          disabled={isBusy}
                          onToggleComplete={(val) =>
                            handleToggleComplete(addr.id, val)
                          }
                          statusColumnName={
                            sheetConfig?.columnMapping?.statusColumnName
                          }
                        />
                      ))}
                    </Stack>
                  </div>
                )}
              </Stack>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="directions" p="md">
            {routeActions.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" mt="xl">
                Optimize a route to see turn-by-turn directions.
              </Text>
            ) : (
              <Timeline active={-1} bulletSize={24} lineWidth={2}>
                {routeActions.map((action, index) => (
                  <Timeline.Item
                    key={index}
                    title={action.action}
                    bullet={
                      <Box
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: "var(--mantine-color-blue-6)",
                        }}
                      />
                    }
                  >
                    <Box
                      onMouseEnter={() => onHoverAction(action)}
                      onMouseLeave={() => onHoverAction(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <Text
                        size="sm"
                        dangerouslySetInnerHTML={{
                          __html: action.instruction,
                        }}
                      />
                      <Group gap="xs" mt={4}>
                        <Text size="xs" c="dimmed">
                          {action.length} m
                        </Text>
                        <Text size="xs" c="dimmed">
                          •
                        </Text>
                        <Text size="xs" c="dimmed">
                          {Math.ceil(action.duration / 60)} min
                        </Text>
                      </Group>
                    </Box>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Tabs.Panel>
        </Tabs>
      </ScrollArea>

      {/* Footer */}
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
            <Text size="xs" c="blue" ta="center">
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
                        TRANSIT_MODES.find((m) => m.mode === transitMode)
                          ?.icon || TRANSIT_MODES[0].icon
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

      {/* Sheet Selection Modal */}
      <Modal
        opened={sheetSelection.isOpen}
        onClose={() =>
          setSheetSelection((prev) => ({ ...prev, isOpen: false }))
        }
        title="Select Sheet"
      >
        <Stack>
          <Text size="xs" c="dimmed">
            {sheetSelection.pendingSpreadsheetName}
          </Text>
          <ScrollArea.Autosize mah={200}>
            <Stack gap={0}>
              {sheetSelection.sheets.map((sheet) => (
                <UnstyledButton
                  key={sheet.id}
                  p="sm"
                  onClick={() => handleSheetSelect(sheet)}
                  style={{ borderRadius: "var(--mantine-radius-sm)" }}
                  // Hover styles need sx or css
                  className="hover:bg-blue-50"
                >
                  <Group justify="space-between">
                    <Text size="sm">{sheet.title}</Text>
                    <Icon path={mdiChevronRight} size={0.6} color="gray" />
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea.Autosize>
          <Button
            variant="subtle"
            color="gray"
            onClick={() =>
              setSheetSelection((prev) => ({ ...prev, isOpen: false }))
            }
          >
            Cancel
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default Sidebar;
