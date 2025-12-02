import React, { useState, useCallback, useEffect } from "react";
import Icon from "@mdi/react";
import {
  mdiSync,
  mdiChevronDown,
  mdiChevronRight,
  mdiGoogleSpreadsheet,
} from "@mdi/js";
import { Address, GeoPoint, ImportStatus, SheetConfig } from "../types";
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
} from "../services/sheetIntegrationService";
import { SheetInfo } from "../services/googleSheetService";
import { createGoogleMapsNavigationLink } from "../services/routeService";
import { AddressCard } from "./AddressCard";

interface SidebarProps {
  addresses: Address[];
  setAddresses: React.Dispatch<React.SetStateAction<Address[]>>;
  onOptimize: () => void;
  isOptimizing: boolean;
  isGeocoding: boolean;
  userLocation: GeoPoint | null;
  onResetKey: () => void;
  onFocusAddress: (id: string) => void;
  onHoverAddress: (id: string | null) => void;
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
}) => {
  const [inputText, setInputText] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>(
    ImportStatus.IDLE,
  );

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

        setAddresses(result.addresses);
        setSheetConfig(result.config);
        setStatusColumnIndex(result.statusColumnIndex);
        setImportStatus(ImportStatus.SUCCESS);
        setTimeout(() => setImportStatus(ImportStatus.IDLE), 3000);
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

      setAddresses(result.addresses);
      setSheetConfig(result.config);
      setStatusColumnIndex(result.statusColumnIndex);
      setImportStatus(ImportStatus.SUCCESS);
      setTimeout(() => setImportStatus(ImportStatus.IDLE), 3000);
    } catch (error) {
      console.error("Error selecting sheet:", error);
      alert("Failed to load selected sheet.");
      setImportStatus(ImportStatus.ERROR);
    } finally {
      setIsSyncing(false);
    }
  };

  const getGoogleMapsLink = () => {
    if (!addresses.length) return "#";
    const nextStop = addresses[0];
    return createGoogleMapsNavigationLink(nextStop);
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
    <div className="w-full bg-white border-r border-gray-200 flex flex-col h-full shadow-xl z-10 relative">
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RouteOptima</h1>
          <p className="text-blue-100 text-sm mt-1">Import. Plan. Navigate.</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <button
            onClick={onResetKey}
            disabled={isBusy}
            className={`text-xs bg-white/10 text-blue-50 px-2 py-1 rounded transition-colors ${
              isBusy ? "opacity-50 cursor-not-allowed" : "hover:bg-white/20"
            }`}
            title="Reset HERE API Key"
          >
            Here Key
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Source Selection Section */}
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-800 ml-1">
            Data Source
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            {/* Header / Collapsed View */}
            <div
              className={`flex items-center justify-between p-3 bg-white ${
                !isSourceExpanded ? "" : "border-b border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {!isSourceExpanded && sheetConfig ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600 overflow-hidden">
                    <Icon
                      path={mdiGoogleSpreadsheet}
                      size={0.8}
                      className="text-green-600"
                    />
                    <span className="truncate font-medium text-gray-900">
                      {sheetConfig.spreadsheetName}
                    </span>
                    {sheetConfig.sheetTitle && (
                      <span className="text-xs text-gray-500 truncate">
                        / {sheetConfig.sheetTitle}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500 font-medium">
                    {isSourceExpanded
                      ? "Configure Import"
                      : "No Source Selected"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {!isSourceExpanded && sheetConfig && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGoogleAction("SYNC");
                    }}
                    disabled={isBusy}
                    className={`p-1.5 rounded-full hover:bg-gray-100 text-green-600 transition-colors ${
                      isBusy ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    title="Sync Sheet"
                  >
                    <Icon path={mdiSync} size={0.8} spin={isSyncing} />
                  </button>
                )}
                <button
                  onClick={() => setIsSourceExpanded(!isSourceExpanded)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                  title={isSourceExpanded ? "Collapse" : "Expand"}
                >
                  <Icon
                    path={isSourceExpanded ? mdiChevronDown : mdiChevronRight}
                    size={0.9}
                  />
                </button>
              </div>
            </div>

            {/* Expanded Content */}
            {isSourceExpanded && (
              <div className="p-4 space-y-4">
                {/* Google Import Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Google Sheets
                    </label>
                    {sheetConfig && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                        {sheetConfig.spreadsheetName}
                      </span>
                    )}
                  </div>

                  {sheetConfig ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGoogleAction("SYNC")}
                        disabled={isBusy}
                        className={`flex-1 py-2 px-3 bg-green-600 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                          isBusy
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-green-700"
                        }`}
                      >
                        <Icon path={mdiSync} size={0.8} spin={isSyncing} />
                        {isSyncing ? "Syncing..." : "Sync Sheet"}
                      </button>
                      <button
                        onClick={() => handleGoogleAction("PICK")}
                        disabled={isBusy}
                        className={`py-2 px-3 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium transition-colors ${
                          isBusy
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-gray-50"
                        }`}
                        title="Change Sheet"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGoogleAction("PICK")}
                      disabled={isBusy}
                      className={`w-full py-2.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm ${
                        isBusy
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <Icon
                        path={mdiGoogleSpreadsheet}
                        size={0.8}
                        className="text-green-600"
                      />
                      Connect Google Sheet
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div
                    className="absolute inset-0 flex items-center"
                    aria-hidden="true"
                  >
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-gray-50 px-2 text-xs text-gray-400 uppercase">
                      Or
                    </span>
                  </div>
                </div>

                {/* Text Import Section */}
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paste Text
                  </label>
                  <textarea
                    className={`w-full h-24 p-3 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow placeholder-gray-400 ${
                      isBusy ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    placeholder="Paste addresses here (e.g. Name | Address)..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isBusy}
                  />
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleImport}
                      disabled={isBusy || !inputText}
                      className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                        isBusy || !inputText
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-slate-800 hover:bg-slate-900"
                      }`}
                    >
                      {importStatus === ImportStatus.PARSING
                        ? "Parsing..."
                        : "Parse Text"}
                    </button>
                    {importStatus === ImportStatus.SUCCESS && (
                      <span className="text-xs text-green-600 font-medium">
                        Imported!
                      </span>
                    )}
                    {importStatus === ImportStatus.ERROR && (
                      <span className="text-xs text-red-600 font-medium">
                        Failed.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* List Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Stops ({addresses.length})
            </h2>
            {addresses.length > 0 && (
              <button
                onClick={() => setAddresses([])}
                disabled={isBusy}
                className={`text-xs text-red-500 ${
                  isBusy
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:text-red-700"
                }`}
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-2">
            {addresses.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-400 text-sm">No addresses added yet.</p>
              </div>
            )}

            {/* Pending Addresses */}
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
              />
            ))}

            {/* Completed Addresses */}
            {completedAddresses.length > 0 && (
              <>
                <div className="border-t border-gray-200 my-4 pt-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Completed
                  </h3>
                </div>
                <div className="opacity-60 grayscale">
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
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-3">
        {isGeocoding && (
          <div className="text-xs text-center text-blue-600 mb-2">
            Geocoding addresses...
          </div>
        )}
        <button
          onClick={onOptimize}
          disabled={
            isOptimizing || isGeocoding || addresses.length < 2 || !userLocation
          }
          className={`w-full py-3 px-4 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm transition-all ${
            isOptimizing || isGeocoding || addresses.length < 2 || !userLocation
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 hover:shadow-md"
          }`}
        >
          {isOptimizing ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Optimizing...
            </span>
          ) : (
            "Optimize Route"
          )}
        </button>

        {addresses.some((a) => a.sequenceOrder) && (
          <a
            href={getGoogleMapsLink()}
            target="_blank"
            rel="noreferrer"
            className="block w-full text-center py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            Start Navigation in Google Maps
          </a>
        )}
      </div>
      {/* Sheet Selection Modal */}
      {sheetSelection.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Select Sheet</h3>
              <p className="text-xs text-gray-500">
                {sheetSelection.pendingSpreadsheetName}
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {sheetSelection.sheets.map((sheet) => (
                <button
                  key={sheet.id}
                  onClick={() => handleSheetSelect(sheet)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-between group"
                >
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    {sheet.title}
                  </span>
                  <svg
                    className="w-4 h-4 text-gray-300 group-hover:text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() =>
                  setSheetSelection((prev) => ({ ...prev, isOpen: false }))
                }
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
