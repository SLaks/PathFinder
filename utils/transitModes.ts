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
    label: "Car",
    icon: mdiCar,
    hereMode: "car",
  },
  {
    mode: "truck",
    label: "Truck",
    icon: mdiTruck,
    hereMode: "truck",
  },
  {
    mode: "pedestrian",
    label: "Walk",
    icon: mdiWalk,
    hereMode: "pedestrian",
  },
  {
    mode: "bicycle",
    label: "Bike",
    icon: mdiBike,
    hereMode: "bicycle",
  },
];

export const DEFAULT_TRANSIT_MODE: TransitMode = "car";
