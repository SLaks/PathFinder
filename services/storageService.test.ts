import { describe, it, expect, beforeEach, vi } from "vitest";
import * as storageService from "./storageService";
import { SheetConfig } from "../types";

describe("storageService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("HERE API Key Management", () => {
    it("should set and get the HERE API key", () => {
      const key = "test-api-key";
      storageService.setHereApiKey(key);
      expect(localStorage.getItem("PathFinder: here_api_key")).toBe(key);
      expect(storageService.getHereApiKey()).toBe(key);
    });

    it("should return null if API key is not set", () => {
      expect(storageService.getHereApiKey()).toBeNull();
    });

    it("should remove the HERE API key", () => {
      const key = "test-api-key";
      localStorage.setItem("PathFinder: here_api_key", key);
      storageService.removeHereApiKey();
      expect(localStorage.getItem("PathFinder: here_api_key")).toBeNull();
      expect(storageService.getHereApiKey()).toBeNull();
    });
  });

  describe("Sheet Configuration Management", () => {
    const mockConfig: SheetConfig = {
      spreadsheetId: "sheet-id",
      spreadsheetName: "Sheet1",
      columnMapping: {
        nameColumnIndices: [0],
        addressColumnIndices: [1],
        statusColumnIndex: 2,
      },
    };

    it("should set and get the sheet config", () => {
      storageService.setSheetConfig(mockConfig);
      const stored = localStorage.getItem("PathFinder: sheet_config");
      expect(stored).toBe(JSON.stringify(mockConfig));
      expect(storageService.getSheetConfig()).toEqual(mockConfig);
    });

    it("should return null if sheet config is not set", () => {
      expect(storageService.getSheetConfig()).toBeNull();
    });

    it("should return null and log error if config is invalid JSON", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      localStorage.setItem("PathFinder: sheet_config", "invalid-json");

      expect(storageService.getSheetConfig()).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should remove the sheet config", () => {
      localStorage.setItem(
        "PathFinder: sheet_config",
        JSON.stringify(mockConfig),
      );
      storageService.removeSheetConfig();
      expect(localStorage.getItem("PathFinder: sheet_config")).toBeNull();
      expect(storageService.getSheetConfig()).toBeNull();
    });
  });
});
