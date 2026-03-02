// Utility functions for Sidebar and related components
import { HereAction } from "../../services/hereService";

export const getActionIcon = (actionItem: HereAction) => {
  const action = actionItem.action.toLowerCase();
  const dir = actionItem.direction?.toLowerCase() || "";

  if (action === "depart") return "mdiMapMarker";
  if (action === "arrive") return "mdiMapMarkerCheck";
  if (action.includes("uturn") || action.includes("u-turn"))
    return "mdiArrowULeftTop";
  if (action === "keep") {
    if (dir.includes("left")) return "mdiArrowTopLeft";
    if (dir.includes("right")) return "mdiArrowTopRight";
    return "mdiArrowUp";
  }
  if (action === "turn") {
    if (dir.includes("left")) return "mdiArrowLeft";
    if (dir.includes("right")) return "mdiArrowRight";
  }
  if (action === "exit" || action === "ramp") {
    if (dir.includes("left")) return "mdiArrowTopLeft";
    if (dir.includes("right")) return "mdiArrowTopRight";
    return "mdiExitToApp";
  }
  if (action === "roundaboutpass" || action.includes("roundabout"))
    return "mdiSync";
  if (action === "fork") return "mdiDirectionsFork";

  if (dir.includes("left")) return "mdiArrowLeft";
  if (dir.includes("right")) return "mdiArrowRight";

  return "mdiArrowUp";
};

export const formatActionTitle = (actionItem: HereAction) => {
  let title = actionItem.action
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  if (actionItem.direction) {
    const dirMap: Record<string, string> = {
      left: "Left",
      right: "Right",
      lightLeft: "Slight Left",
      lightRight: "Slight Right",
      hardLeft: "Hard Left",
      hardRight: "Hard Right",
      middle: "Straight",
    };
    const formattedDir =
      dirMap[actionItem.direction] ||
      actionItem.direction.charAt(0).toUpperCase() +
        actionItem.direction.slice(1);

    if (!title.toLowerCase().includes(formattedDir.toLowerCase())) {
      title += ` ${formattedDir}`;
    }
  }

  return title.trim();
};

export const formatDistance = (meters: number) => {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

export const formatDuration = (seconds: number) => {
  if (seconds < 60) return "< 1 min";
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hrs} h ${remainingMins} min` : `${hrs} h`;
};
