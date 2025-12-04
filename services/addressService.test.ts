import { describe, it, expect, vi } from "vitest";
import * as addressService from "./addressService";
import * as geminiService from "./geminiService";
import { ColumnMapping } from "../types";

// Mock geminiService
vi.mock("./geminiService", () => ({
  parseAddressesWithGemini: vi.fn(),
  identifyColumnsWithGemini: vi.fn(),
}));

describe("addressService", () => {
  describe("generateAddressId", () => {
    it("should generate a string ID", () => {
      const id = addressService.generateAddressId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should generate unique IDs", () => {
      const id1 = addressService.generateAddressId();
      const id2 = addressService.generateAddressId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("parseAddressesFromText", () => {
    it("should parse addresses using Gemini service", async () => {
      const mockParsed = [
        { address: "123 Main St", name: "John Doe" },
        { address: "456 Elm St", name: undefined },
      ];
      vi.mocked(geminiService.parseAddressesWithGemini).mockResolvedValue(
        mockParsed,
      );

      const result = await addressService.parseAddressesFromText("some text");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        originalText: "123 Main St",
        name: "John Doe",
        isGeocoding: true,
      });
      expect(result[1]).toMatchObject({
        originalText: "456 Elm St",
        name: undefined,
        isGeocoding: true,
      });
    });
  });

  describe("identifySheetColumns", () => {
    it("should enrich mapping with status column name", async () => {
      const headers = ["Address", "Name", "Status"];
      const sampleRow = ["123 Main", "John", "Done"];
      const mockMapping: ColumnMapping = {
        addressColumnIndices: [0],
        nameColumnIndices: [1],
        statusColumnIndex: 2,
      };

      vi.mocked(geminiService.identifyColumnsWithGemini).mockResolvedValue(
        mockMapping,
      );

      const result = await addressService.identifySheetColumns(
        headers,
        sampleRow,
      );

      expect(result.statusColumnName).toBe("Status");
      expect(result.statusColumnIndex).toBe(2);
    });
  });

  describe("createAddressFromSheet", () => {
    const mapping: ColumnMapping = {
      addressColumnIndices: [0, 1], // Address split across col 0 and 1
      nameColumnIndices: [2], // Name in col 2
      statusColumnIndex: 3, // Status in col 3
    };

    it("should create address from row with multiple columns", () => {
      const row = ["123", "Main St", "John", ""];
      const result = addressService.createAddressFromSheet(row, mapping, 0);

      expect(result).toMatchObject({
        originalText: "123 Main St",
        name: "John",
        sheetRow: 2,
        completed: false,
      });
    });

    it("should handle completed status", () => {
      const row = ["123", "Main St", "John", "Done"];
      const result = addressService.createAddressFromSheet(row, mapping, 0);
      expect(result?.completed).toBe(true);
    });

    it("should return null for empty address", () => {
      const row = ["", "", "John", ""];
      const result = addressService.createAddressFromSheet(row, mapping, 0);
      expect(result).toBeNull();
    });
  });

  describe("separateAddressesByStatus", () => {
    it("should separate active and completed addresses", () => {
      const addresses = [
        { id: "1", originalText: "", completed: false },
        { id: "2", originalText: "", completed: true },
        { id: "3", originalText: "", completed: false },
      ];

      const { active, completed } =
        addressService.separateAddressesByStatus(addresses);

      expect(active).toHaveLength(2);
      expect(active.map((a) => a.id)).toEqual(["1", "3"]);
      expect(completed).toHaveLength(1);
      expect(completed.map((a) => a.id)).toEqual(["2"]);
    });
  });
});
