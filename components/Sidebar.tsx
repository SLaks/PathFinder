import React, { useState, useCallback, useEffect } from "react";
import { Address, GeoPoint, ImportStatus, SheetConfig } from "../types";
import {
  parseAddressesWithGemini,
  identifyColumnsWithGemini,
} from "../services/geminiService";
import {
  loadGoogleModules,
  getAccessToken,
  openGooglePicker,
  fetchSheetData,
  updateSheetCell,
  fetchSheetMetadata,
  SheetInfo,
} from "../services/googleSheetService";
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

const STORAGE_SHEET_CONFIG = "routeoptima_sheet_config";

// Hardcoded Google Credentials
const GOOGLE_CLIENT_ID =
  "377676797720-gue2trd92glfihma88lsm813je9u51al.apps.googleusercontent.com";
// Note: The user provided a Client Secret. In a typical Google JS Client setup,
// an API Key (starting with AIza) is expected for the 'apiKey' field in gapi.client.init
// and picker builder.
const GOOGLE_API_KEY = "AIzaSyChd3QUP4K-8psCmCh8RzKnqJ6Vwrys44M";

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
    ImportStatus.IDLE
  );

  // Google Sheets State
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(null);
  const [statusColumnIndex, setStatusColumnIndex] = useState<number | null>(
    null
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

  // Load saved configs on mount
  useEffect(() => {
    const savedSheet = localStorage.getItem(STORAGE_SHEET_CONFIG);
    if (savedSheet) setSheetConfig(JSON.parse(savedSheet));
  }, []);

  const processTextData = useCallback(
    async (text: string) => {
      setImportStatus(ImportStatus.PARSING);
      try {
        const parsed = await parseAddressesWithGemini(text);
        const newAddresses: Address[] = parsed.map((item) => ({
          id: Math.random().toString(36).substr(2, 9),
          originalText: item.address,
          name: item.name,
          isGeocoding: true,
        }));
        setAddresses(newAddresses);
        setImportStatus(ImportStatus.SUCCESS);

        // Clear status after 3 seconds
        setTimeout(() => setImportStatus(ImportStatus.IDLE), 3000);
      } catch (e) {
        console.error(e);
        setImportStatus(ImportStatus.ERROR);
      }
    },
    [setAddresses, setImportStatus]
  );

  const handleImport = useCallback(async () => {
    if (!inputText.trim()) return;
    await processTextData(inputText);
  }, [inputText, processTextData]);

  const handleGoogleAction = async (action: "PICK" | "SYNC") => {
    setIsSyncing(true);
    try {
      // 1. Initialize Google Libraries with hardcoded creds
      await loadGoogleModules(GOOGLE_API_KEY, GOOGLE_CLIENT_ID);

      // 2. Get Access Token
      const token = await getAccessToken();

      let targetSheetId = sheetConfig?.spreadsheetId;
      let targetSheetName = sheetConfig?.spreadsheetName;
      let targetSheetTitle = sheetConfig?.sheetTitle;
      let targetMapping = sheetConfig?.columnMapping;

      // 3. Pick File if needed
      if (action === "PICK" || !targetSheetId) {
        const file = await openGooglePicker(token, GOOGLE_API_KEY);
        if (!file) {
          setIsSyncing(false);
          return; // User cancelled
        }
        targetSheetId = file.id;
        targetSheetName = file.name;

        // Fetch sheets to see if we need to ask user
        const sheets = await fetchSheetMetadata(targetSheetId);

        if (sheets.length > 1) {
          setSheetSelection({
            isOpen: true,
            sheets,
            pendingSpreadsheetId: targetSheetId,
            pendingSpreadsheetName: targetSheetName,
          });
          setIsSyncing(false);
          return; // Stop here, wait for user selection
        }

        // Default to first sheet
        targetSheetTitle = sheets[0].title;
        // Reset mapping on new sheet pick
        targetMapping = undefined;

        const newConfig: SheetConfig = {
          spreadsheetId: targetSheetId,
          spreadsheetName: targetSheetName,
          sheetId: sheets[0].id,
          sheetTitle: targetSheetTitle,
        };
        setSheetConfig(newConfig);
        localStorage.setItem(STORAGE_SHEET_CONFIG, JSON.stringify(newConfig));
      }

      // 4. Fetch Data
      if (targetSheetId) {
        // If syncing existing config, use its sheetTitle
        const { headers, rows } = await fetchSheetData(
          targetSheetId,
          targetSheetTitle
        );

        if (!headers || headers.length === 0) {
          alert("Sheet is empty or missing headers.");
          setIsSyncing(false);
          return;
        }

        // 5. Identify Columns (if not cached)
        if (!targetMapping) {
          setImportStatus(ImportStatus.PARSING);
          // Use the first row as sample
          const sampleRow = rows.length > 0 ? rows[0] : [];
          targetMapping = await identifyColumnsWithGemini(headers, sampleRow);

          // Save mapping
          const updatedConfig: SheetConfig = {
            spreadsheetId: targetSheetId,
            spreadsheetName: targetSheetName!,
            sheetTitle: targetSheetTitle,
            columnMapping: targetMapping,
          };
          setSheetConfig(updatedConfig);
          localStorage.setItem(
            STORAGE_SHEET_CONFIG,
            JSON.stringify(updatedConfig)
          );
        }

        // 6. Parse Data using Mapping
        if (targetMapping) {
          setStatusColumnIndex(targetMapping.statusColumnIndex ?? null);

          const newAddresses: Address[] = [];

          rows.forEach((row, rowIndex) => {
            // Concatenate address parts
            const addressParts = targetMapping!.addressColumnIndices.map(idx => row[idx]).filter(Boolean);
            const addressText = addressParts.join(" ");
            
            if (!addressText.trim()) return; // Skip empty addresses

            // Concatenate name parts
            const nameParts = targetMapping!.nameColumnIndices
                ? targetMapping!.nameColumnIndices.map(idx => row[idx]).filter(Boolean)
                : [];
            const nameText = nameParts.length > 0 ? nameParts.join(" ") : undefined;
            
            let isCompleted = false;
            if (targetMapping!.statusColumnIndex !== undefined) {
               const statusVal = row[targetMapping!.statusColumnIndex]?.toLowerCase() || "";
               isCompleted = ["yes", "true", "done", "completed", "x", "1"].includes(statusVal);
            }

            newAddresses.push({
              id: Math.random().toString(36).substr(2, 9),
              originalText: addressText,
              name: nameText,
              isGeocoding: true,
              sheetRow: rowIndex + 2, // +2 because 1-based and header is row 1
              completed: isCompleted,
            });
          });

          setAddresses(newAddresses);
          setImportStatus(ImportStatus.SUCCESS);
          setTimeout(() => setImportStatus(ImportStatus.IDLE), 3000);
        }
      }
    } catch (error) {
      console.error("Google Sheet Error:", error);
      alert(
        "Failed to connect to Google Sheets. Ensure your account has access."
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

      const newConfig: SheetConfig = {
        spreadsheetId: pendingSpreadsheetId,
        spreadsheetName: pendingSpreadsheetName,
        sheetId: sheet.id,
        sheetTitle: sheet.title,
      };

      setSheetConfig(newConfig);
      localStorage.setItem(STORAGE_SHEET_CONFIG, JSON.stringify(newConfig));

      const { headers, rows } = await fetchSheetData(
        pendingSpreadsheetId,
        sheet.title
      );

      // Find "Delivered" or "Status" column
      let statusColIdx = -1;
      const statusKeywords = [
        "delivered",
        "done",
        "completed",
        "status",
        "complete",
      ];

      if (headers) {
        statusColIdx = headers.findIndex((h) =>
          statusKeywords.includes(h.toLowerCase().trim())
        );
      }
      setStatusColumnIndex(statusColIdx);

      const rawText = rows.map((r) => r.join(" | ")).join("\n");

      // Duplicate logic from above - should refactor but inline for now to save tool calls
      setImportStatus(ImportStatus.PARSING);
      const parsedItems = await parseAddressesWithGemini(rawText);

      const newAddresses: Address[] = [];
      const usedRows = new Set<number>();

      parsedItems.forEach((item) => {
        let bestRowIdx = -1;
        for (let i = 0; i < rows.length; i++) {
          if (usedRows.has(i)) continue;
          const rowStr = rows[i].join(" ").toLowerCase();
          if (rowStr.includes(item.address.toLowerCase().split(",")[0])) {
            bestRowIdx = i;
            break;
          }
        }

        let isCompleted = false;
        if (bestRowIdx !== -1) {
          usedRows.add(bestRowIdx);
          if (statusColIdx !== -1 && rows[bestRowIdx][statusColIdx]) {
            const statusVal = rows[bestRowIdx][statusColIdx].toLowerCase();
            isCompleted = [
              "yes",
              "true",
              "done",
              "completed",
              "x",
              "1",
            ].includes(statusVal);
          }
        }

        newAddresses.push({
          id: Math.random().toString(36).substr(2, 9),
          originalText: item.address,
          name: item.name,
          isGeocoding: true,
          sheetRow: bestRowIdx !== -1 ? bestRowIdx + 2 : undefined,
          completed: isCompleted,
        });
      });

      setAddresses(newAddresses);
      setImportStatus(ImportStatus.SUCCESS);
      setTimeout(() => setImportStatus(ImportStatus.IDLE), 3000);
    } catch (error) {
      console.error("Error selecting sheet:", error);
      alert("Failed to load selected sheet.");
    } finally {
      setIsSyncing(false);
    }
  };

  const getGoogleMapsLink = () => {
    if (!addresses.length) return "#";
    const nextStop = addresses[0];
    if (!nextStop.location) return "#";
    return `https://www.google.com/maps/dir/?api=1&destination=${nextStop.location.lat},${nextStop.location.lng}&travelmode=driving`;
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    // 1. Update local state
    setAddresses((prev) =>
      prev.map((a) => (a.id === id ? { ...a, completed } : a))
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
        await updateSheetCell(
          sheetConfig.spreadsheetId,
          sheetConfig.sheetTitle || "Sheet1",
          addr.sheetRow,
          statusColumnIndex,
          completed ? "TRUE" : "FALSE"
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
        {/* Google Import Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Import Source
            </label>
            {sheetConfig && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                {sheetConfig.spreadsheetName}
                {sheetConfig.sheetTitle && ` / ${sheetConfig.sheetTitle}`}
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
                {isSyncing ? "Loading..." : "Sync Sheet"}
              </button>
              <button
                onClick={() => handleGoogleAction("PICK")}
                disabled={isBusy}
                className={`py-2 px-3 bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors ${
                  isBusy ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-300"
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
                isBusy ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
              }`}
            >
              <svg
                className="w-5 h-5 text-green-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              Connect Google Sheet
            </button>
          )}
        </div>

        <div className="relative">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-2 text-xs text-gray-500 uppercase">
              Or Paste Text
            </span>
          </div>
        </div>

        {/* Text Import Section */}
        <div className="space-y-3">
          <textarea
            className={`w-full h-24 p-3 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow placeholder-gray-400 ${
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
              <span className="text-xs text-red-600 font-medium">Failed.</span>
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
