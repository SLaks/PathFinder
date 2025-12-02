import { Address, ColumnMapping } from "../types";
import {
  parseAddressesWithGemini,
  identifyColumnsWithGemini,
} from "./geminiService";

/**
 * Address Service
 * Handles address parsing, creation, and management
 */

/**
 * Generate unique address ID
 */
export function generateAddressId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Parse addresses from plain text input using Gemini AI
 */
export async function parseAddressesFromText(text: string): Promise<Address[]> {
  const parsed = await parseAddressesWithGemini(text);
  return parsed.map((item) => ({
    id: generateAddressId(),
    originalText: item.address,
    name: item.name,
    isGeocoding: true,
  }));
}

/**
 * Identify column mapping from sheet headers using Gemini AI
 */
export async function identifySheetColumns(
  headers: string[],
  sampleRow: string[],
): Promise<ColumnMapping> {
  return await identifyColumnsWithGemini(headers, sampleRow);
}

/**
 * Create an address object from a sheet row using column mapping
 */
export function createAddressFromSheet(
  row: string[],
  mapping: ColumnMapping,
  rowIndex: number,
): Address | null {
  // Concatenate address parts
  const addressParts = mapping.addressColumnIndices
    .map((idx) => row[idx])
    .filter(Boolean);
  const addressText = addressParts.join(" ");

  if (!addressText.trim()) return null; // Skip empty addresses

  // Concatenate name parts
  const nameParts = mapping.nameColumnIndices
    ? mapping.nameColumnIndices.map((idx) => row[idx]).filter(Boolean)
    : [];
  const nameText = nameParts.length > 0 ? nameParts.join(" ") : undefined;

  // Check completion status
  let isCompleted = false;
  if (mapping.statusColumnIndex !== undefined) {
    const statusVal = row[mapping.statusColumnIndex]?.toLowerCase() || "";
    isCompleted = ["yes", "true", "done", "completed", "x", "1"].includes(
      statusVal,
    );
  }

  return {
    id: generateAddressId(),
    originalText: addressText,
    name: nameText,
    isGeocoding: true,
    sheetRow: rowIndex + 2, // +2 because 1-based and header is row 1
    completed: isCompleted,
  };
}

/**
 * Parse addresses from sheet data using column mapping
 */
export function parseAddressesFromSheet(
  rows: string[][],
  mapping: ColumnMapping,
): Address[] {
  const addresses: Address[] = [];

  rows.forEach((row, rowIndex) => {
    const address = createAddressFromSheet(row, mapping, rowIndex);
    if (address) {
      addresses.push(address);
    }
  });

  return addresses;
}

/**
 * Separate addresses into active and completed
 */
export function separateAddressesByStatus(addresses: Address[]): {
  active: Address[];
  completed: Address[];
} {
  return {
    active: addresses.filter((a) => !a.completed),
    completed: addresses.filter((a) => a.completed),
  };
}
