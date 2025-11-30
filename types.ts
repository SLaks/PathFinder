export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  id: string;
  name?: string;
  originalText: string;
  location?: GeoPoint;
  formattedAddress?: string;
  sequenceOrder?: number; // For TSP result
  isGeocoding?: boolean;
}

export interface RouteSummary {
  distance: number; // in meters
  travelTime: number; // in seconds
}

export interface AppState {
  hereApiKey: string;
  addresses: Address[];
  userLocation: GeoPoint | null;
  isOptimizing: boolean;
  isGeocoding: boolean;
  optimizedRouteShape: string[]; // LineString points for drawing
}

export enum ImportStatus {
  IDLE,
  PARSING,
  SUCCESS,
  ERROR,
}

export interface GoogleCreds {
  clientId: string;
  apiKey: string;
}

export interface SheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetId?: number;
  sheetTitle?: string;
}
