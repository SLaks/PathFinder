declare namespace gapi.client.sheets {
  interface SpreadsheetsResource {
    get(params: { spreadsheetId: string }): Promise<{
      result: {
        sheets: Array<{
          properties: {
            sheetId: number;
            title: string;
          };
        }>;
      };
    }>;
    values: {
      get(params: {
        spreadsheetId: string;
        range: string;
      }): Promise<{ result: { values?: string[][] } }>;
      update(params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: string;
        resource: { values: Array<Array<string | boolean | number>> };
      }): Promise<unknown>;
    };
  }
  const spreadsheets: SpreadsheetsResource;
}

// From https://github.com/TeemuKoivisto/google-oauth-drive-example/blob/a0fdb2d04b2e4f4c49777abfeed4dcdcf8077259/packages/client/src/google.d.ts
interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback?: (data: { access_token: string }) => void;
}

interface TokenClient {
  requestAccessToken: () => void;
}

interface CredentialResponse {
  credential?: string;
  select_by?:
    | "auto"
    | "user"
    | "user_1tap"
    | "user_2tap"
    | "btn"
    | "btn_confirm"
    | "brn_add_session"
    | "btn_confirm_add_session";
  clientId?: string;
}

interface GsiButtonConfiguration {
  type: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signup_with";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: string;
  local?: string;
}

declare namespace google.accounts.id {
  export function initialize(params: {
    client_id: string;
    callback: (res: CredentialResponse) => void;
  }): void;
  export function renderButton(
    parent: HTMLElement,
    options: GsiButtonConfiguration,
    clickHandler?: () => void,
  ): void;
}

declare namespace google.accounts.oauth2 {
  export function revoke(token: string): void;
  export function initTokenClient(
    tokenClientConfig: TokenClientConfig,
  ): TokenClient;
  export function hasGrantedAllScopes(scope: string): boolean;
}
