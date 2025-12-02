import { Address, SheetConfig } from "../types";
import {
  loadGoogleModules,
  getAccessToken,
  openGooglePicker,
  fetchSheetData,
  updateSheetCell,
  fetchSheetMetadata,
  SheetInfo,
} from "./googleSheetService";
import {
  parseAddressesFromSheet,
  identifySheetColumns,
} from "./addressService";
import { setSheetConfig } from "./storageService";

/**
 * Sheet Integration Service
 * Orchestrates Google Sheets integration
 */

// Hardcoded Google Credentials
const GOOGLE_CLIENT_ID =
  "377676797720-gue2trd92glfihma88lsm813je9u51al.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyChd3QUP4K-8psCmCh8RzKnqJ6Vwrys44M";

export interface SheetPickerResult {
  requiresSheetSelection: boolean;
  spreadsheetId?: string;
  spreadsheetName?: string;
  sheets?: SheetInfo[];
}

export interface SheetSyncResult {
  addresses: Address[];
  config: SheetConfig;
  statusColumnIndex: number | null;
}

/**
 * Initialize Google Sheets and authenticate
 */
export async function initializeGoogleSheets(): Promise<string> {
  await loadGoogleModules(GOOGLE_API_KEY, GOOGLE_CLIENT_ID);
  return await getAccessToken();
}

/**
 * Open Google Picker and handle initial sheet selection
 * Returns spreadsheet info and sheets if multi-sheet selection needed
 */
export async function pickSheet(token: string): Promise<SheetPickerResult> {
  const file = await openGooglePicker(token, GOOGLE_API_KEY);
  if (!file) {
    return { requiresSheetSelection: false };
  }

  const sheets = await fetchSheetMetadata(file.id);

  if (sheets.length > 1) {
    return {
      requiresSheetSelection: true,
      spreadsheetId: file.id,
      spreadsheetName: file.name,
      sheets,
    };
  }

  // Single sheet - no selection needed
  return {
    requiresSheetSelection: false,
    spreadsheetId: file.id,
    spreadsheetName: file.name,
    sheets: [sheets[0]],
  };
}

/**
 * Sync data from a configured sheet
 */
export async function syncSheetData(
  config: SheetConfig,
): Promise<SheetSyncResult> {
  const { headers, rows } = await fetchSheetData(
    config.spreadsheetId,
    config.sheetTitle,
  );

  if (!headers || headers.length === 0) {
    throw new Error("Sheet is empty or missing headers");
  }

  let mapping = config.columnMapping;

  // Identify columns if not cached
  if (!mapping) {
    const sampleRow = rows.length > 0 ? rows[0] : [];
    mapping = await identifySheetColumns(headers, sampleRow);

    // Update config with mapping
    const updatedConfig: SheetConfig = {
      ...config,
      columnMapping: mapping,
    };
    setSheetConfig(updatedConfig);
  }

  // Parse addresses
  const addresses = parseAddressesFromSheet(rows, mapping);

  return {
    addresses,
    config: {
      ...config,
      columnMapping: mapping,
    },
    statusColumnIndex: mapping.statusColumnIndex ?? null,
  };
}

/**
 * Update completion status in Google Sheet
 */
export async function updateSheetStatus(
  config: SheetConfig,
  rowIndex: number,
  statusColumnIndex: number,
  completed: boolean,
): Promise<void> {
  await updateSheetCell(
    config.spreadsheetId,
    config.sheetTitle || "Sheet1",
    rowIndex,
    statusColumnIndex,
    completed ? "TRUE" : "FALSE",
  );
}

/**
 * Complete sheet selection and sync for a specific sheet
 */
export async function selectAndSyncSheet(
  spreadsheetId: string,
  spreadsheetName: string,
  sheet: SheetInfo,
): Promise<SheetSyncResult> {
  const config: SheetConfig = {
    spreadsheetId,
    spreadsheetName,
    sheetId: sheet.id,
    sheetTitle: sheet.title,
  };

  setSheetConfig(config);

  return await syncSheetData(config);
}
