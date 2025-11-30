declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOC =
  "https://sheets.googleapis.com/$discovery/rest?version=v4";

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const loadGoogleModules = (
  apiKey: string,
  clientId: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const checkLibs = () => {
      if (window.gapi && window.google) {
        initGapi(apiKey)
          .then(() => {
            gapiInited = true;
            initGis(clientId).then(() => {
              gisInited = true;
              resolve();
            });
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
    callback: "", // defined at request time
  });
};

export const getAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject("Google Identity Services not initialized");

    tokenClient.callback = (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
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

    const pickerCallback = (data: any) => {
      if (data.action === window.google.picker.Action.PICKED) {
        const doc = data.docs[0];
        resolve({
          id: doc.id,
          name: doc.name,
        });
      } else if (data.action === window.google.picker.Action.CANCEL) {
        resolve(null);
      }
    };

    const view = new window.google.picker.View(
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
  spreadsheetId: string
): Promise<SheetInfo[]> => {
  try {
    const meta = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    return meta.result.sheets.map((s: any) => ({
      id: s.properties.sheetId,
      title: s.properties.title,
    }));
  } catch (error) {
    console.error("Error fetching sheet metadata:", error);
    throw error;
  }
};

export const fetchSheetRows = async (
  spreadsheetId: string,
  sheetTitle?: string
): Promise<string[]> => {
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
      range: `${rangeName}!A1:Z100`, // Grab a reasonable chunk
    });

    const rows = response.result.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Convert rows to pipe-delimited strings for the Gemini parser
    return rows.map((row: any[]) => row.join(" | "));
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    throw error;
  }
};
