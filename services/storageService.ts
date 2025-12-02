import { SheetConfig } from "../types";

const STORAGE_KEY_HERE_API = "here_api_key";
const STORAGE_KEY_SHEET_CONFIG = "routeoptima_sheet_config";

/**
 * Storage Service
 * Centralizes all localStorage operations for the application
 */

// HERE API Key Management
export function getHereApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY_HERE_API);
}

export function setHereApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY_HERE_API, key);
}

export function removeHereApiKey(): void {
  localStorage.removeItem(STORAGE_KEY_HERE_API);
}

// Sheet Configuration Management
export function getSheetConfig(): SheetConfig | null {
  const saved = localStorage.getItem(STORAGE_KEY_SHEET_CONFIG);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to parse sheet config from storage", e);
    return null;
  }
}

export function setSheetConfig(config: SheetConfig): void {
  localStorage.setItem(STORAGE_KEY_SHEET_CONFIG, JSON.stringify(config));
}

export function removeSheetConfig(): void {
  localStorage.removeItem(STORAGE_KEY_SHEET_CONFIG);
}
