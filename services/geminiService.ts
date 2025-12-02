import { GoogleGenAI, Type } from "@google/genai";
import { ColumnMapping } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseAddressesWithGemini = async (
  text: string
): Promise<{ name?: string; address: string }[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `The user has pasted content from a spreadsheet containing addresses. 
      Extract the full address strings into a clean list.
      If the input contains names associated with the addresses (e.g. in a separate column or preceding the address), extract the name as well.
      Ignore headers or irrelevant columns if possible. 
      
      Input text:
      ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description:
                  "The name of the person or location, if available.",
              },
              address: {
                type: Type.STRING,
                description: "The address string.",
              },
            },
            required: ["address"],
          },
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Failed to parse addresses with Gemini:", error);
    throw new Error("AI parsing failed. Please try standard formatting.");
  }
};

export const identifyColumnsWithGemini = async (
  headers: string[],
  sampleRow: string[]
): Promise<ColumnMapping> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following spreadsheet headers and a sample row to identify the column indices for:
      1. Address (Required): The columns that make up the address (e.g., "Address", "City", "State", "Zip"). Return ALL relevant column indices in order.
      2. Name (Optional): The columns that make up the name (e.g., "First Name", "Last Name"). Return ALL relevant column indices in order.
      3. Status (Optional): A column indicating if the stop is completed/delivered (e.g., "Delivered", "Status", "Done").

      Headers: ${JSON.stringify(headers)}
      Sample Row: ${JSON.stringify(sampleRow)}
      
      Return the 0-based index for each found column. If not found, omit the field.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            addressColumnIndices: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Indices of address columns in order",
            },
            nameColumnIndices: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Indices of name columns in order",
            },
            statusColumnIndex: {
              type: Type.INTEGER,
              description: "Index of the status/delivered column",
            },
          },
          required: ["addressColumnIndices"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("Empty response from Gemini");
  } catch (error) {
    console.error("Failed to identify columns with Gemini:", error);
    throw error;
  }
};
