import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseAddressesWithGemini = async (text: string): Promise<{name?: string, address: string}[]> => {
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
                description: "The name of the person or location, if available."
              },
              address: {
                type: Type.STRING,
                description: "The address string."
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
