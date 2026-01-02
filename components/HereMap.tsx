import React, { useCallback, useEffect, useRef } from "react";
import { MantineProvider, useMantineColorScheme } from "@mantine/core";
import { Address, GeoPoint } from "../types";
import { HereAction } from "../services/hereService";
import "@here/maps-api-for-javascript";
import { getAddressColor } from "../utils/colors";
import { getInitials } from "../utils/formatters";
import { AddressCard } from "./AddressCard";
import { theme } from "../theme";
import { createRoot } from "react-dom/client";

interface HereMapProps {
  apiKey: string;
  userLocation: GeoPoint | null;
  addresses: Address[];
  routeShape: string[]; // Encoded polylines
  focusedAddressId: string | null;
  hoveredAddressId: string | null;
  hoveredAction?: HereAction | null;
}

const HereMap: React.FC<HereMapProps> = ({
  apiKey,
  userLocation,
  addresses,
  routeShape,
  focusedAddressId,
  hoveredAddressId,
  hoveredAction,
}) => {
  const { colorScheme } = useMantineColorScheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const hMapRef = useRef<H.Map>(null);
  const uiRef = useRef<H.ui.UI>(null);
  const groupRef = useRef<H.map.Group>(null);
  const routeGroupRef = useRef<H.map.Group>(null);
  const hoverCircleRef = useRef<H.map.Circle | null>(null);

  const showBubble = useCallback(
    (addr: Address, marker: H.map.Marker) => {
      if (!uiRef.current) return;

      // Close existing bubbles
      uiRef.current.getBubbles().forEach((b) => uiRef.current!.removeBubble(b));

      const content = document.createElement("div");
      createRoot(content).render(
        <MantineProvider theme={theme}>
          <div style={{ padding: "8px" }}>
            <AddressCard
              address={addr}
              index={addresses.indexOf(addr)}
              isCompact
            />
          </div>
        </MantineProvider>,
      );

      const point = marker.getGeometry() as H.geo.Point;
      const hMap = hMapRef.current!;

      // Move the point up so it doesn't cover the marker.
      const { x, y } = hMap.geoToScreen(point)!;
      const bubble = new window.H.ui.InfoBubble(
        hMap.screenToGeo(x, y - 36) || point,
        { content },
      );
      uiRef.current!.addBubble(bubble);
    },
    [addresses],
  );

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || !window.H) return;
    if (!apiKey) return;

    const platform = new window.H.service.Platform({
      apikey: apiKey,
    });

    const defaultLayers = platform.createDefaultLayers();

    const map = new window.H.Map(
      mapRef.current,
      colorScheme === "dark"
        ? defaultLayers.vector.normal.mapnight
        : defaultLayers.vector.normal.map,
      {
        center: userLocation || { lat: 50, lng: 5 },
        zoom: 16,
        pixelRatio: window.devicePixelRatio || 1,
      },
    );

    // Interactive behavior
    new window.H.mapevents.Behavior(new window.H.mapevents.MapEvents(map));

    // UI
    uiRef.current! = window.H.ui.UI.createDefault(map, defaultLayers);

    // Group for Markers
    const group = new window.H.map.Group();
    map.addObject(group);
    groupRef.current = group;

    // Group for Route
    const routeGroup = new window.H.map.Group();
    map.addObject(routeGroup);
    routeGroupRef.current = routeGroup;

    hMapRef.current = map;

    // Resize handler
    const resizeHandler = () => map.getViewPort().resize();
    window.addEventListener("resize", resizeHandler);

    return () => {
      window.removeEventListener("resize", resizeHandler);
      map.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, colorScheme]);

  // Update User Location & Markers
  useEffect(() => {
    if (!hMapRef.current || !window.H) return;

    const map = hMapRef.current;
    const group = groupRef.current!;
    group.removeAll();

    // User Location Marker
    if (userLocation) {
      const userIcon = new window.H.map.Icon(
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`,
        { size: { w: 24, h: 24 }, anchor: { x: 12, y: 12 } },
      );
      const userMarker = new window.H.map.Marker(userLocation, {
        icon: userIcon,
        data: { id: "user" },
      });
      group.addObject(userMarker);
    }

    // Address Markers
    addresses.forEach((addr, index) => {
      if (addr.location) {
        const color = getAddressColor(index);
        const initials = getInitials(addr.name || addr.originalText);
        const opacity = addr.completed ? 0.4 : 1.0;

        const svgMarkup = `<svg width="30" height="36" xmlns="http://www.w3.org/2000/svg" opacity="${opacity}">
          <path d="M15 0C6.7 0 0 6.7 0 15c0 10 15 21 15 21s15-11 15-21c0-8.3-6.7-15-15-15z" fill="${color}" stroke="white" stroke-width="2"/>
          <text x="15" y="21" font-size="12" font-family="Arial" font-weight="bold" text-anchor="middle" fill="white">${initials}</text>
        </svg>`;

        const icon = new window.H.map.Icon(svgMarkup, {
          anchor: { x: 15, y: 36 },
        });
        const marker = new window.H.map.Marker(addr.location, {
          icon,
          data: { id: addr.id },
        });

        // Add bubble
        marker.addEventListener("tap", () => {
          showBubble(addr, marker);
        });

        group.addObject(marker);
      }
    });

    if (addresses.length > 0 || userLocation) {
      const objects = group.getObjects();
      if (objects.length === 1) {
        const marker = objects[0] as H.map.Marker;
        map.getViewModel().setLookAtData({
          position: marker.getGeometry() as H.geo.Point,
          zoom: 16,
        });
      } else {
        map.getViewModel().setLookAtData({
          bounds: group.getBoundingBox(),
        });
      }
    }
  }, [addresses, userLocation, showBubble, colorScheme]);

  // Handle Focus Address
  useEffect(() => {
    if (!hMapRef.current || !focusedAddressId || !groupRef.current) return;

    const targetAddr = addresses.find((a) => a.id === focusedAddressId);
    if (targetAddr && targetAddr.location) {
      // Zoom
      hMapRef.current.getViewModel().setLookAtData(
        {
          position: targetAddr.location,
          zoom: 16,
        },
        true, // animate
      );

      // Show Bubble
      const markers = groupRef.current.getObjects();
      const targetMarker = markers
        .filter((m) => m instanceof H.map.Marker)
        .find((m) => m.getData()?.id === focusedAddressId);

      if (targetMarker) {
        showBubble(targetAddr, targetMarker);
      }
    }
  }, [focusedAddressId, addresses, showBubble]);

  // Handle Hover Highlight with Circle
  useEffect(() => {
    if (!hMapRef.current || !window.H) return;

    const map = hMapRef.current;

    // Remove existing hover circle
    if (hoverCircleRef.current) {
      map.removeObject(hoverCircleRef.current);
      hoverCircleRef.current = null;
    }

    // Add new hover circle if there's a hovered address
    if (hoveredAddressId) {
      const targetAddr = addresses.find((a) => a.id === hoveredAddressId);
      if (targetAddr && targetAddr.location) {
        const circle = new window.H.map.Circle(
          targetAddr.location,
          50, // radius in meters
        );
        circle.setStyle({
          strokeColor: "rgba(37, 99, 235, 0.8)", // blue-600
          lineWidth: 3,
          fillColor: "rgba(37, 99, 235, 0.2)",
        });
        map.addObject(circle);
        hoverCircleRef.current = circle;
      }
    }
  }, [hoveredAddressId, addresses]);

  // Handle Hover Highlight for Action (Direction Instruction)
  useEffect(() => {
    if (!hMapRef.current || !window.H) return;

    const map = hMapRef.current;

    // Use a separate circle for action highlight to avoid conflict or reuse?
    // Let's reuse hoverCircleRef if possible, or create a new one.
    // Since hoveredAddressId and hoveredAction are mutually exclusive interaction-wise (usually), reuse might be fine.
    // But let's handle strictly.

    if (hoveredAction && routeShape[hoveredAction.sectionIndex]) {
      const lineString = window.H.geo.LineString.fromFlexiblePolyline(
        routeShape[hoveredAction.sectionIndex],
      );
      // offset is index of coordinate
      const point = lineString.extractPoint(hoveredAction.offset);

      if (hoverCircleRef.current) {
        map.removeObject(hoverCircleRef.current);
      }

      const circle = new window.H.map.Circle(
        point,
        30, // radius
      );
      circle.setStyle({
        strokeColor: "rgba(255, 165, 0, 0.8)", // Orange for instructions
        lineWidth: 3,
        fillColor: "rgba(255, 165, 0, 0.4)",
      });
      map.addObject(circle);
      hoverCircleRef.current = circle;
    } else if (!hoveredAddressId && hoverCircleRef.current) {
      // clear if neither address nor action is hovered
      map.removeObject(hoverCircleRef.current);
      hoverCircleRef.current = null;
    }
  }, [hoveredAction, routeShape, hoveredAddressId]);

  // Update Route Polyline
  useEffect(() => {
    if (!hMapRef.current || !window.H || !routeGroupRef.current) return;
    const routeGroup = routeGroupRef.current;
    routeGroup.removeAll();

    if (routeShape && routeShape.length > 0) {
      routeShape.forEach((encodedPoly) => {
        const lineString =
          window.H.geo.LineString.fromFlexiblePolyline(encodedPoly);
        const outline = new window.H.map.Polyline(lineString, {
          style: {
            lineWidth: 6,
            strokeColor: "rgba(0, 0, 0, 0.5)",
            lineCap: "butt",
          },
          data: { id: "route-outline" },
        });
        const routeLine = new window.H.map.Polyline(lineString, {
          style: { lineWidth: 4, strokeColor: "#2563eb", lineCap: "butt" },
          data: { id: "route" },
        });

        routeGroup.addObject(outline);
        routeGroup.addObject(routeLine);
      });
    }
  }, [routeShape]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor:
          colorScheme === "dark"
            ? "var(--mantine-color-dark-8)"
            : "var(--mantine-color-gray-2)",
      }}
    >
      <style>{colorScheme === "dark" ? darkModeStyles : ""}</style>
    </div>
  );
};

// Here offers no options to style the bubble colors, so we override it for dark mode.
const darkModeStyles = `
.H_ib.H_ib_top .H_ib_tail::after {
  /* The lower triangle */
  border-color: var(--mantine-color-dark-5) transparent !important;
}
.H_ib_body {
  background-color: var(--mantine-color-dark-5) !important;
}
.H_ib_content {
  color: var(--mantine-color-gray-0) !important;
}
`;
export default HereMap;
