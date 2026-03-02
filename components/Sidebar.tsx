import React, { useState, useCallback, useEffect } from "react";
import {
  Stack,
  Group,
  Box,
  Text,
  Button,
  ScrollArea,
  Title,
  Tabs,
  useMantineColorScheme,
} from "@mantine/core";
import iconUrl from "../images/icon.png";
import {
  Address,
  GeoPoint,
  ImportStatus,
  SheetConfig,
  TransitMode,
} from "../types";
import { HereAction } from "../services/hereService";
import {
  createAddressFromSheet,
  parseAddressesFromText,
} from "../services/addressService";
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
import { SidebarRowDialog } from "./sidebar/SidebarRowDialog";
import { updateSheetCell } from "../services/googleSheetService";
import { SidebarDataSourcePanel } from "./sidebar/SidebarDataSourcePanel";
import { SidebarAddressList } from "./sidebar/SidebarAddressList";
import { SidebarDirectionsPanel } from "./sidebar/SidebarDirectionsPanel";
import { SidebarFooter } from "./sidebar/SidebarFooter";
import { SidebarSheetSelectionModal } from "./sidebar/SidebarSheetSelectionModal";

// Utility functions moved to SidebarUtils.ts

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
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isSavingRow, setIsSavingRow] = useState(false);
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
    if (sheetConfig) setIsSourceExpanded(false);
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
      let errorMessage =
        "Failed to connect to Google Sheets. Ensure your account has access.";
      if (/AI|Firebase|Gemini/i.test((error as Error).message)) {
        errorMessage =
          "Failed to parse sheet columns with Gemini.  Try again later.";
      }
      alert(errorMessage);
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

  const handleSaveRow = async (newData: string[]) => {
    if (!editingAddress || !editingAddress.sheetRow || !sheetConfig) return;

    setIsSavingRow(true);
    try {
      // Find what changed and update cells
      const originalData = editingAddress.fullRowData || [];
      const updates = newData
        .map((val, idx) => (val !== originalData[idx] ? { val, idx } : null))
        .filter((u): u is { val: string; idx: number } => u !== null);

      await Promise.all(
        updates.map((update) =>
          updateSheetCell(
            sheetConfig.spreadsheetId,
            sheetConfig.sheetTitle!,
            editingAddress.sheetRow!,
            update.idx,
            update.val,
          ),
        ),
      );

      // Update local state
      setAddresses((prev) =>
        prev.map((a) =>
          a.id === editingAddress.id
            ? createAddressFromSheet(
                newData,
                sheetConfig.columnMapping!,
                editingAddress.sheetRow!,
                editingAddress.headers,
              )!
            : a,
        ),
      );
      setEditingAddress(null);
    } catch (error) {
      console.error("Failed to save row changes:", error);
      alert("Failed to save changes to the spreadsheet.");
    } finally {
      setIsSavingRow(false);
    }
  };

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
      <Box p="md" bg="emerald.6" c="white" className="print-hidden">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <img src={iconUrl} alt="Logo" style={{ width: 48, height: 48 }} />
            <Box>
              <Title order={1} size="h3">
                PathFinder
              </Title>
              <Text size="sm" c="gold.4">
                Import. Plan. Navigate.
              </Text>
            </Box>
          </Group>
          <Button
            variant="white"
            size="xs"
            bg="white"
            c="emerald.6"
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
              <SidebarDataSourcePanel
                colorScheme={colorScheme}
                isSourceExpanded={isSourceExpanded}
                setIsSourceExpanded={setIsSourceExpanded}
                sheetConfig={sheetConfig}
                isSyncing={isSyncing}
                isBusy={isBusy}
                handleGoogleAction={handleGoogleAction}
                inputText={inputText}
                setInputText={setInputText}
                handleImport={handleImport}
                importStatus={importStatus}
              />
              <SidebarAddressList
                colorScheme={colorScheme}
                addresses={addresses}
                setAddresses={setAddresses}
                isBusy={isBusy}
                onFocusAddress={onFocusAddress}
                onHoverAddress={onHoverAddress}
                handleToggleComplete={handleToggleComplete}
                sheetConfig={sheetConfig}
                onEditRow={setEditingAddress}
              />
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="directions" p="md">
            <SidebarDirectionsPanel
              routeActions={routeActions}
              onHoverAction={onHoverAction}
            />
          </Tabs.Panel>
        </Tabs>
      </ScrollArea>

      {/* Footer */}
      <SidebarFooter
        colorScheme={colorScheme}
        isGeocoding={isGeocoding}
        isOptimizing={isOptimizing}
        addresses={addresses}
        userLocation={userLocation}
        transitMode={transitMode}
        onTransitModeChange={onTransitModeChange}
        onOptimize={onOptimize}
        getGoogleMapsLink={getGoogleMapsLink}
      />

      {/* Sheet Selection Modal */}
      <SidebarSheetSelectionModal
        isOpen={sheetSelection.isOpen}
        sheets={sheetSelection.sheets}
        pendingSpreadsheetName={sheetSelection.pendingSpreadsheetName}
        onClose={() =>
          setSheetSelection((prev) => ({ ...prev, isOpen: false }))
        }
        onSelect={handleSheetSelect}
      />

      <SidebarRowDialog
        key={editingAddress?.id}
        opened={!!editingAddress}
        onClose={() => setEditingAddress(null)}
        address={editingAddress}
        onSave={handleSaveRow}
        isSaving={isSavingRow}
      />
    </Stack>
  );
};

export default Sidebar;
