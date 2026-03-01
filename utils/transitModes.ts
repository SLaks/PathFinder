import { mdiCar, mdiTruck, mdiWalk, mdiBike } from "@mdi/js";
import { TransitMode } from "../types";

export interface TransitModeInfo {
  mode: TransitMode;
  label: string;
  icon: string;
  hereMode: string; // The mode value to send to HERE API
}

export const TRANSIT_MODES: TransitModeInfo[] = [
  {
    mode: "car",
    label: "Driving",
    icon: mdiCar,
    hereMode: "car",
  },
  {
    mode: "pedestrian",
    label: "Walking",
    icon: mdiWalk,
    hereMode: "pedestrian",
  },
  {
    mode: "bicycle",
    label: "Biking",
    icon: mdiBike,
    hereMode: "bicycle",
  },
  {
    mode: "truck",
    label: "Trucking",
    icon: mdiTruck,
    hereMode: "truck",
  },
];

export const DEFAULT_TRANSIT_MODE: TransitMode = "car";
