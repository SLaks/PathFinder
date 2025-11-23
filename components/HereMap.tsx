import React, { useEffect, useRef } from 'react';
import { Address, GeoPoint } from '../types';

// Declare global HERE namespace
declare global {
  interface Window {
    H: any;
  }
}

interface HereMapProps {
  apiKey: string;
  userLocation: GeoPoint | null;
  addresses: Address[];
  routeShape: string[]; // Encoded polylines
}

const HereMap: React.FC<HereMapProps> = ({ apiKey, userLocation, addresses, routeShape }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const hMapRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const groupRef = useRef<any>(null);
  const routeGroupRef = useRef<any>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || !window.H || hMapRef.current) return;
    if (!apiKey) return;

    const platform = new window.H.service.Platform({
      apikey: apiKey,
    });

    const defaultLayers = platform.createDefaultLayers();

    const map = new window.H.Map(
      mapRef.current,
      defaultLayers.vector.normal.map,
      {
        center: userLocation || { lat: 50, lng: 5 },
        zoom: 4,
        pixelRatio: window.devicePixelRatio || 1,
      }
    );

    // Interactive behavior
    new window.H.mapevents.Behavior(new window.H.mapevents.MapEvents(map));
    
    // UI
    uiRef.current = window.H.ui.UI.createDefault(map, defaultLayers);

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
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      map.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Update User Location & Markers
  useEffect(() => {
    if (!hMapRef.current || !window.H) return;

    const map = hMapRef.current;
    const group = groupRef.current;
    group.removeAll();

    // User Location Marker
    if (userLocation) {
      const userIcon = new window.H.map.Icon(
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`,
        { size: { w: 24, h: 24 }, anchor: { x: 12, y: 12 } }
      );
      const userMarker = new window.H.map.Marker(userLocation, { icon: userIcon });
      group.addObject(userMarker);
    }

    // Address Markers
    addresses.forEach((addr, index) => {
      if (addr.location) {
        const label = addr.sequenceOrder !== undefined ? `${addr.sequenceOrder}` : `${index + 1}`;
        
        const svgMarkup = `<svg width="30" height="36" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 0C6.7 0 0 6.7 0 15c0 10 15 21 15 21s15-11 15-21c0-8.3-6.7-15-15-15z" fill="#ea4335" stroke="white" stroke-width="2"/>
          <text x="15" y="21" font-size="12" font-family="Arial" font-weight="bold" text-anchor="middle" fill="white">${label}</text>
        </svg>`;

        const icon = new window.H.map.Icon(svgMarkup, { anchor: { x: 15, y: 36 } });
        const marker = new window.H.map.Marker(addr.location, { icon });
        
        // Add bubble
        marker.addEventListener('tap', (evt: any) => {
             const content = `
                <div class="p-2 text-sm">
                    ${addr.name ? `<div class="font-bold text-base mb-1">${addr.name}</div>` : ''}
                    <div><b>${label}.</b> ${addr.formattedAddress || addr.originalText}</div>
                </div>
             `;
             const bubble = new window.H.ui.InfoBubble(evt.target.getGeometry(), {
                content: content
             });
             uiRef.current.addBubble(bubble);
        });

        group.addObject(marker);
      }
    });

    if (addresses.length > 0 || userLocation) {
      map.getViewModel().setLookAtData({
        bounds: group.getBoundingBox(),
      });
    }
  }, [addresses, userLocation]);

  // Update Route Polyline
  useEffect(() => {
    if (!hMapRef.current || !window.H || !routeGroupRef.current) return;
    const routeGroup = routeGroupRef.current;
    routeGroup.removeAll();

    if (routeShape && routeShape.length > 0) {
      routeShape.forEach(encodedPoly => {
          const lineString = window.H.geo.LineString.fromFlexiblePolyline(encodedPoly);
          const outline = new window.H.map.Polyline(lineString, {
            style: { lineWidth: 6, strokeColor: 'rgba(0, 0, 0, 0.5)', lineCap: 'butt' }
          });
          const routeLine = new window.H.map.Polyline(lineString, {
            style: { lineWidth: 4, strokeColor: '#2563eb', lineCap: 'butt' }
          });
          
          routeGroup.addObject(outline);
          routeGroup.addObject(routeLine);
      });
    }
  }, [routeShape]);

  return <div ref={mapRef} className="w-full h-full bg-gray-200" />;
};

export default HereMap;
