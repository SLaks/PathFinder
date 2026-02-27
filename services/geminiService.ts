import { ensureAuthenticated, ai } from "./firebase";
import { getGenerativeModel, SchemaType } from "firebase/ai";
import { ColumnMapping } from "../types";

export const parseAddressesWithGemini = async (
  text: string,
): Promise<{ name?: string; address: string }[]> => {
  try {
    await ensureAuthenticated();
    const model = getGenerativeModel(ai, {
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          nullable: false,
          items: {
            type: SchemaType.OBJECT,
            nullable: false,
            properties: {
              name: {
                type: SchemaType.STRING,
                nullable: true,
                description:
                  "The name of the person or location, if available.",
              },
              address: {
                type: SchemaType.STRING,
                nullable: false,
                description: "The address string.",
              },
            },
            required: ["address"],
          },
        },
      },
    });

    const response =
      await model.generateContent(`The user has pasted content from a spreadsheet containing addresses. 
      Extract the full address strings into a clean list.
      If the input contains names associated with the addresses (e.g. in a separate column or preceding the address), extract the name as well.
      Ignore headers or irrelevant columns if possible. 
      
      Input text:
      ${text}`);

    if (response.response.text()) {
      return JSON.parse(response.response.text());
    }
    return [];
  } catch (error) {
    console.error("Failed to parse addresses with Gemini:", error);
    throw new Error("AI parsing failed. Please try standard formatting.");
  }
};

export const identifyColumnsWithGemini = async (
  headers: string[],
  sampleRow: string[],
): Promise<ColumnMapping> => {
  try {
    await ensureAuthenticated();
    const model = getGenerativeModel(ai, {
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          nullable: false,
          properties: {
            addressColumnIndices: {
              type: SchemaType.ARRAY,
              nullable: false,
              items: { type: SchemaType.INTEGER, nullable: false },
              description: "Indices of address columns in order",
            },
            nameColumnIndices: {
              type: SchemaType.ARRAY,
              nullable: false,
              items: { type: SchemaType.INTEGER, nullable: false },
              description: "Indices of name columns in order",
            },
            statusColumnIndex: {
              type: SchemaType.INTEGER,
              nullable: true,
              description: "Index of the status/delivered column",
            },
          },
          required: ["addressColumnIndices"],
        },
      },
    });

    const response =
      await model.generateContent(`Analyze the following spreadsheet headers and a sample row to identify the column indices for:
      1. Address (Required): The columns that make up the address (e.g., "Address", "City", "State", "Zip").
         Return ALL relevant column indices in proper order to render an address.
         Ignore columns with duplicate information (e.g., if "Full Address" is present, ignore "Address", "City", etc.; ignore a "Street" column if the street name is already in other address columns).
      2. Name (Optional): The columns that make up the name (e.g., "First Name", "Last Name"). Return ALL relevant column indices in display order (First, Last).
      3. Status (Optional): A column indicating if the stop is completed/delivered (e.g., "Delivered", "Status", "Done").

      Headers: ${JSON.stringify(headers)}
      Sample Row: ${JSON.stringify(sampleRow)}
      
      Return the 0-based index for each found column. If not found, omit the field.`);

    if (response.response.text()) {
      return JSON.parse(response.response.text());
    }
    throw new Error("Empty response from Gemini");
  } catch (error) {
    console.error("Failed to identify columns with Gemini:", error);
    throw error;
  }
};
