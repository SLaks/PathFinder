import React, { useState, useCallback, useEffect } from "react";
import { Address, GeoPoint, ImportStatus, SheetConfig } from "../types";
import { parseAddressesWithGemini } from "../services/geminiService";
import {
  loadGoogleModules,
  getAccessToken,
  openGooglePicker,
  fetchSheetRows,
  fetchSheetMetadata,
  SheetInfo,
} from "../services/googleSheetService";

interface SidebarProps {
  addresses: Address[];
  setAddresses: React.Dispatch<React.SetStateAction<Address[]>>;
  onOptimize: () => void;
  isOptimizing: boolean;
  isGeocoding: boolean;
  userLocation: GeoPoint | null;
  onResetKey: () => void;
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
}) => {
  const [inputText, setInputText] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>(
    ImportStatus.IDLE
  );

  // Google Sheets State
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
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

  const processTextData = async (text: string) => {
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
  };

  const handleImport = useCallback(async () => {
    if (!inputText.trim()) return;
    await processTextData(inputText);
  }, [inputText, setAddresses]);

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
        const rows = await fetchSheetRows(targetSheetId, targetSheetTitle);
        const rawText = rows.join("\n");
        await processTextData(rawText);
      }
    } catch (error) {
      console.error("Google Sheet Error:", error);
      alert(
        "Failed to connect to Google Sheets. Ensure your account has access."
      );
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

      const rows = await fetchSheetRows(pendingSpreadsheetId, sheet.title);
      const rawText = rows.join("\n");
      await processTextData(rawText);
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
            className="text-xs bg-white/10 hover:bg-white/20 text-blue-50 px-2 py-1 rounded transition-colors"
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
                disabled={isSyncing || importStatus === ImportStatus.PARSING}
                className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSyncing ? "Loading..." : "Sync Sheet"}
              </button>
              <button
                onClick={() => handleGoogleAction("PICK")}
                disabled={isSyncing}
                className="py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm font-medium transition-colors"
                title="Change Sheet"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleGoogleAction("PICK")}
              disabled={isSyncing}
              className="w-full py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
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
            className="w-full h-24 p-3 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow placeholder-gray-400"
            placeholder="Paste addresses here (e.g. Name | Address)..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <button
              onClick={handleImport}
              disabled={importStatus === ImportStatus.PARSING || !inputText}
              className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                importStatus === ImportStatus.PARSING
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
                className="text-xs text-red-500 hover:text-red-700"
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
            {addresses.map((addr, idx) => {
              const isError = !addr.location && !addr.isGeocoding;
              const isLoading = addr.isGeocoding;

              let rowClass = "bg-white border-gray-200 hover:border-blue-300";
              if (isError) rowClass = "bg-red-50 border-red-100";
              if (isLoading) rowClass = "bg-blue-50 border-blue-100";

              return (
                <div
                  key={addr.id}
                  className={`p-3 rounded-lg border text-sm flex gap-3 items-start transition-all ${rowClass}`}
                >
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      addr.sequenceOrder
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {isLoading ? (
                      <svg
                        className="animate-spin h-4 w-4 text-blue-600"
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
                    ) : (
                      addr.sequenceOrder ?? idx + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {addr.name && (
                      <p className="text-gray-900 font-bold truncate">
                        {addr.name}
                      </p>
                    )}
                    <p
                      className={`${
                        addr.name
                          ? "text-gray-500 text-xs"
                          : "text-gray-900 font-medium"
                      } truncate`}
                    >
                      {addr.formattedAddress || addr.originalText}
                    </p>
                    {isLoading && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        Finding location...
                      </p>
                    )}
                    {isError && (
                      <p className="text-xs text-red-500 mt-0.5">
                        Location not found
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
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
