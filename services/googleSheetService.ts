import "@types/gsi/index.d.ts";
import "@types/gapi/index.d.ts";
import "@types/google.picker/index.d.ts";
import "../google.d.ts";

const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOC =
  "https://sheets.googleapis.com/$discovery/rest?version=v4";

// Google API Response Types
interface TokenResponse {
  error?: string;
  access_token: string;
  expires_in?: number;
}

interface SheetMetadata {
  properties: {
    sheetId: number;
    title: string;
  };
}

interface TokenClientType {
  callback?: (response: TokenResponse) => void;
  requestAccessToken: (options: { prompt: string }) => void;
}

let tokenClient: TokenClientType | null = null;

export const loadGoogleModules = (
  apiKey: string,
  clientId: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const checkLibs = () => {
      if (window.gapi && window.google) {
        initGapi(apiKey)
          .then(() => {
            initGis(clientId).then(resolve);
          })
          .catch(reject);
      } else {
        setTimeout(checkLibs, 100);
      }
    };
    checkLibs();
  });
};

const initGapi = async (apiKey: string) => {
  await new Promise<void>((resolve, reject) => {
    window.gapi.load("client:picker", {
      callback: resolve,
      onerror: reject,
    });
  });
  await window.gapi.client.init({
    apiKey: apiKey,
    discoveryDocs: [DISCOVERY_DOC],
  });
};

const initGis = async (clientId: string) => {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
  });
};

const STORAGE_KEY = "google_access_token";
const EXPIRY_KEY = "google_access_token_expiry";

export const getAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 1. Check local storage
    const storedToken = localStorage.getItem(STORAGE_KEY);
    const storedExpiry = localStorage.getItem(EXPIRY_KEY);

    if (storedToken && storedExpiry) {
      const expiryTime = parseInt(storedExpiry, 10);
      // Add a buffer of 5 minutes to be safe
      if (Date.now() < expiryTime - 5 * 60 * 1000) {
        gapi.client.setToken({ access_token: storedToken });
        return resolve(storedToken);
      }
    }

    if (!tokenClient) return reject("Google Identity Services not initialized");

    tokenClient.callback = (resp: TokenResponse) => {
      if (resp.error !== undefined) {
        reject(resp);
      }

      // 2. Save to local storage
      const expiresIn = resp.expires_in || 3599; // Default to ~1 hour if missing
      const expiryTime = Date.now() + expiresIn * 1000;

      localStorage.setItem(STORAGE_KEY, resp.access_token);
      localStorage.setItem(EXPIRY_KEY, expiryTime.toString());

      resolve(resp.access_token);
    };

    // Prompt the user to select an account and provide consent
    tokenClient.requestAccessToken({ prompt: "" });
  });
};

export const openGooglePicker = (
  accessToken: string,
  apiKey: string,
): Promise<{ id: string; name: string } | null> => {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.picker) {
      return reject("Google Picker API not loaded");
    }

    const pickerCallback = (data: google.picker.ResponseObject) => {
      if (data.action === window.google.picker.Action.PICKED) {
        const doc = data.docs?.[0];
        if (doc) {
          resolve({
            id: doc.id,
            name: doc.name || "",
          });
        } else {
          resolve(null);
        }
      } else if (data.action === window.google.picker.Action.CANCEL) {
        resolve(null);
      }
    };

    const view = new window.google.picker.DocsView(
      window.google.picker.ViewId.SPREADSHEETS,
    );
    const picker = new window.google.picker.PickerBuilder()
      .setDeveloperKey(apiKey)
      .setAppId("377676797720")
      .setOAuthToken(accessToken)
      .addView(view)
      .setCallback(pickerCallback)
      .build();

    picker.setVisible(true);
  });
};

export interface SheetInfo {
  id: number;
  title: string;
}

export const fetchSheetMetadata = async (
  spreadsheetId: string,
): Promise<SheetInfo[]> => {
  try {
    const meta = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    return meta.result.sheets.map((s: SheetMetadata) => ({
      id: s.properties.sheetId,
      title: s.properties.title,
    }));
  } catch (error) {
    console.error("Error fetching sheet metadata:", error);
    throw error;
  }
};

export interface SheetData {
  headers: string[];
  rows: string[][];
}

export const fetchSheetData = async (
  spreadsheetId: string,
  sheetTitle?: string,
): Promise<SheetData> => {
  try {
    let rangeName = "";

    if (sheetTitle) {
      rangeName = sheetTitle;
    } else {
      // 1. Get spreadsheet metadata to find the first sheet name if not provided
      const meta = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
      });
      rangeName = meta.result.sheets[0].properties.title;
    }

    // 2. Get values from the sheet
    const response = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${rangeName}!A1:Z1000`, // Grab a reasonable chunk, increased to 1000
    });

    const values = response.result.values;
    if (!values || values.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = values[0];
    const rows = values.slice(1);

    return { headers, rows };
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    throw error;
  }
};

export const updateSheetCell = async (
  spreadsheetId: string,
  sheetTitle: string,
  rowIndex: number, // 1-based index
  colIndex: number, // 0-based index (A=0, B=1, etc.)
  value: string | boolean | number,
): Promise<void> => {
  try {
    const colLetter = String.fromCharCode(65 + colIndex); // Simple A-Z conversion. TODO: Handle AA, AB etc if needed
    const range = `${sheetTitle}!${colLetter}${rowIndex}`;

    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[value]],
      },
    });
  } catch (error) {
    console.error("Error updating sheet cell:", error);
    throw error;
  }
};
