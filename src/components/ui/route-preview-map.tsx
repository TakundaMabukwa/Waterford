"use client"

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Route } from 'lucide-react';
import { useGoogleMaps } from '@/hooks/use-google-maps';

declare global {
  interface Window {
    google: typeof google;
  }
}

interface RoutePreviewMapProps {
  origin: string;
  destination: string;
  originCoordinates?: { lat: number; lng: number } | null;
  destinationCoordinates?: { lat: number; lng: number } | null;
  stopPoints?: Array<{
    id: number | string;
    name: string;
    coordinates: number[][];
    sourceType?: string;
  }> | string;
  getStopPointsData?: () => Promise<any[]>;
  driverLocation?: {
    lat: number;
    lng: number;
    name: string;
  };
  clientLocation?: {
    lat: number;
    lng: number;
    name: string;
  };
  selectedClient?: any;
  tripId?: string;
  preserveOrder?: boolean;
}

export function RoutePreviewMap({ origin, destination, originCoordinates, destinationCoordinates, stopPoints = [], getStopPointsData, driverLocation, clientLocation, selectedClient, tripId, preserveOrder = false }: RoutePreviewMapProps) {
  const { loaded, error: loadError } = useGoogleMaps();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const lastUpdateRef = useRef<string>('');
  const cacheRef = useRef<Map<string, any>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const overlaysRef = useRef<(google.maps.Polyline | google.maps.Polygon | google.maps.Circle)[]>([]);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  useEffect(() => {
    if (!loaded || !mapContainer.current || map.current) return;

    map.current = new window.google.maps.Map(mapContainer.current, {
      center: { lat: -26.2041, lng: 28.0473 },
      zoom: 5,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    map.current.addListener('idle', () => {
      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      overlaysRef.current.forEach(o => o.setMap(null));
      overlaysRef.current = [];
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
        trafficLayerRef.current = null;
      }
      if (map.current) {
        map.current = null;
      }
    };
  }, [loaded]);

  useEffect(() => {
    if (!mapLoaded || (!origin && !destination && !selectedClient?.coordinates)) return;

    const stopPointsKey = Array.isArray(stopPoints) ? stopPoints.map(p => p?.id || p).join(',') : stopPoints || '';
    const driverKey = driverLocation ? `${driverLocation.lat}-${driverLocation.lng}-${driverLocation.name}` : '';
    const getStopPointsKey = getStopPointsData ? 'hasStopPoints' : 'noStopPoints';
    const preserveOrderKey = preserveOrder ? 'preserve' : 'optimize';
    const cacheKey = `${origin}-${destination}-${stopPointsKey}-${selectedClient?.id || ''}-${tripId || ''}-${driverKey}-${getStopPointsKey}-${preserveOrderKey}`;

    const shouldUpdate = lastUpdateRef.current !== cacheKey || stopPoints === 'async';
    if (!shouldUpdate) return;

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);

    updateTimeoutRef.current = setTimeout(() => {
      lastUpdateRef.current = cacheKey;
      updateRoute();
    }, 200);

    const clearOverlays = () => {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      overlaysRef.current.forEach(o => o.setMap(null));
      overlaysRef.current = [];
    };

    const updateRoute = async () => {
      if (!map.current || !mapLoaded) return;
      clearOverlays();

      const mapInstance = map.current;
      const bounds = new window.google.maps.LatLngBounds();

      try {
        let originCoords = originCoordinates || null;
        let destCoords = destinationCoordinates || null;

        if ((!originCoords || !destCoords) && origin && destination) {
          [originCoords, destCoords] = await Promise.all([
            originCoords || geocodeLocation(origin),
            destCoords || geocodeLocation(destination)
          ]);
        }

        // Add driver location marker
        if (driverLocation) {
          const marker = new window.google.maps.Marker({
            position: { lat: driverLocation.lat, lng: driverLocation.lng },
            map: mapInstance,
            title: `Driver: ${driverLocation.name}`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#1e40af',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });
          markersRef.current.push(marker);
          bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lng });
        }

        // Add origin marker
        if (originCoords && origin) {
          const marker = new window.google.maps.Marker({
            position: { lat: originCoords.lat, lng: originCoords.lng },
            map: mapInstance,
            title: origin,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#22c55e',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });
          markersRef.current.push(marker);
          bounds.extend({ lat: originCoords.lat, lng: originCoords.lng });
        }

        // Add destination marker
        if (destCoords && destination) {
          const marker = new window.google.maps.Marker({
            position: { lat: destCoords.lat, lng: destCoords.lng },
            map: mapInstance,
            title: destination,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });
          markersRef.current.push(marker);
          bounds.extend({ lat: destCoords.lat, lng: destCoords.lng });
        }

        // Collect stop points for route waypoints
        let routeStopPoints: any[] = [];
        if (stopPoints === 'async' && getStopPointsData) {
          routeStopPoints = await getStopPointsData();
          console.log('[RoutePreviewMap] stop points for waypoints:', routeStopPoints.length, routeStopPoints);
        } else if (Array.isArray(stopPoints)) {
          routeStopPoints = stopPoints;
          console.log('[RoutePreviewMap] static stop points:', routeStopPoints.length);
        }

        // Load Mapbox route and render on Google Map
        let mainRouteGeoJSON = await getMapboxRoute(originCoords, destCoords, routeStopPoints);

        if (mainRouteGeoJSON?.coordinates?.length > 0) {
          const path = mainRouteGeoJSON.coordinates.map((c: number[]) => ({
            lat: c[1],
            lng: c[0]
          }));

          const polyline = new window.google.maps.Polyline({
            path,
            map: mapInstance,
            strokeColor: '#3b82f6',
            strokeOpacity: 1.0,
            strokeWeight: 6,
          });
          overlaysRef.current.push(polyline);
          path.forEach(p => bounds.extend(p));
        }

        // Handle stop points
        if (stopPoints === 'async' && getStopPointsData) {
          const asyncStopPoints = await getStopPointsData();
          if (asyncStopPoints?.length > 0) {
            asyncStopPoints.forEach((sp: any, i: number) => addStopPointToMap(sp, i, mapInstance, bounds));
          }
        } else if (Array.isArray(stopPoints) && stopPoints.length > 0) {
          stopPoints.forEach((sp, i) => addStopPointToMap(sp, i, mapInstance, bounds));
        }

        // Draw client geozone polygon if available
        if (selectedClient?.coordinates) {
          try {
            const parsed = JSON.parse(selectedClient.coordinates)
            if (Array.isArray(parsed) && parsed.length >= 3) {
              const path = parsed.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
              const polygon = new window.google.maps.Polygon({
                paths: path,
                map: mapInstance,
                strokeColor: '#7c3aed',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#7c3aed',
                fillOpacity: 0.12,
              })
              overlaysRef.current.push(polygon)

              const labelLat = path.reduce((s: number, p: any) => s + p.lat, 0) / path.length
              const labelLng = path.reduce((s: number, p: any) => s + p.lng, 0) / path.length
              const label = new window.google.maps.Marker({
                position: { lat: labelLat, lng: labelLng },
                map: mapInstance,
                title: `Geozone: ${selectedClient.name}`,
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 6,
                  fillColor: '#7c3aed',
                  fillOpacity: 0.4,
                  strokeColor: '#5b21b6',
                  strokeWeight: 2,
                },
              })
              overlaysRef.current.push(label as any)
              path.forEach((p: any) => bounds.extend(p))
            }
          } catch {
            // coordinates is not polygon JSON — skip
          }
        }

        // Traffic layer
        if (!trafficLayerRef.current) {
          trafficLayerRef.current = new window.google.maps.TrafficLayer();
          trafficLayerRef.current.setMap(mapInstance);
        }

        // High-risk areas
        await loadHighRiskAreas(mapInstance);

        // Fit bounds
        if (!bounds.isEmpty()) {
          mapInstance.fitBounds(bounds, 60);
        }

      } catch (error) {
        console.error('Error updating route:', error);
      }
    };

    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, [mapLoaded, origin, destination, originCoordinates, destinationCoordinates, selectedClient, tripId, stopPoints, driverLocation, getStopPointsData, preserveOrder]);

  const getMapboxRoute = async (originCoords: any, destCoords: any, stopPointsList: any[] = []) => {
    if (!originCoords || !destCoords) return null;

    const cacheKey = `route-${originCoords.lat}-${originCoords.lng}-${destCoords.lat}-${destCoords.lng}-${stopPointsList.length}`;
    if (cacheRef.current.has(cacheKey)) return cacheRef.current.get(cacheKey);

    const getCentroid = (point: any): { lat: number; lng: number } | null => {
      const coords = point.coordinates;
      if (!coords || coords.length === 0) return null;
      const avgLng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
      const avgLat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
      if (isNaN(avgLat) || isNaN(avgLng)) return null;
      return { lat: avgLat, lng: avgLng };
    };

    try {
      const intermediates = stopPointsList
        .map(getCentroid)
        .filter((c): c is { lat: number; lng: number } => c !== null)
        .map(c => ({ lat: c.lat, lng: c.lng }));

      const routesBody = {
        origin: { lat: originCoords.lat, lng: originCoords.lng },
        destination: { lat: destCoords.lat, lng: destCoords.lng },
        intermediates,
      };

      const res = await fetch('/api/osrm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routesBody),
      });

      if (!res.ok) {
        console.warn('[RoutePreviewMap] OSRM API HTTP error:', res.status);
        return null;
      }

      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) {
        console.warn('[RoutePreviewMap] No route returned:', data);
        return null;
      }

      const geometry = route.geometry;
      if (!geometry?.coordinates?.length) {
        console.warn('[RoutePreviewMap] No geometry in route');
        return null;
      }

      cacheRef.current.set(cacheKey, geometry);
      return geometry;
    } catch (error) {
      console.error('[RoutePreviewMap] Route fetch error:', error);
      return null;
    }
  };

  const addStopPointToMap = (stopPoint: any, index: number, mapInstance: google.maps.Map, bounds: google.maps.LatLngBounds) => {
    if (!stopPoint.coordinates?.length) return;

    const coords = stopPoint.coordinates;
    const avgLng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
    const avgLat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
    const isFuelStop = stopPoint.sourceType === 'fuel_stop';

    if (coords.length >= 3) {
      const polygon = new window.google.maps.Polygon({
        paths: coords.map((c: number[]) => ({ lat: c[1], lng: c[0] })),
        map: mapInstance,
        strokeColor: isFuelStop ? '#15803d' : `hsl(${(index * 60) % 360}, 70%, 40%)`,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: isFuelStop ? '#22c55e' : `hsl(${(index * 60) % 360}, 70%, 50%)`,
        fillOpacity: isFuelStop ? 0.22 : 0.4,
      });
      overlaysRef.current.push(polygon);
    } else {
      const lngs = coords.map((c: number[]) => c[0]);
      const lats = coords.map((c: number[]) => c[1]);
      const radiusKm = Math.max(
        (Math.max(...lngs) - Math.min(...lngs)) * 111.32 * Math.cos(avgLat * Math.PI / 180),
        (Math.max(...lats) - Math.min(...lats)) * 110.54
      ) / 2;

      const circle = new window.google.maps.Circle({
        center: { lat: avgLat, lng: avgLng },
        radius: Math.max(100, radiusKm * 1000),
        map: mapInstance,
        strokeColor: isFuelStop ? '#15803d' : '#4682B4',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: isFuelStop ? '#22c55e' : '#87CEEB',
        fillOpacity: isFuelStop ? 0.22 : 0.3,
      });
      overlaysRef.current.push(circle);
    }

    const marker = new window.google.maps.Marker({
      position: { lat: avgLat, lng: avgLng },
      map: mapInstance,
      title: `${isFuelStop ? 'Fuel Stop' : 'Stop'} ${index + 1}: ${stopPoint.name}`,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: isFuelStop ? '#16a34a' : '#ff6b35',
        fillOpacity: 0.8,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
    markersRef.current.push(marker);
    bounds.extend({ lat: avgLat, lng: avgLng });
  };

  const loadHighRiskAreas = async (mapInstance: google.maps.Map) => {
    try {
      const response = await fetch('/api/high-risk-areas');
      if (!response.ok) return;
      const { data: areas } = await response.json();
      areas?.forEach((area: any) => {
        if (!area.coordinates) return;
        const coords = area.coordinates.split(' ')
          .filter((c: string) => c.trim())
          .map((c: string) => { const [lng, lat] = c.split(','); return [parseFloat(lng), parseFloat(lat)]; })
          .filter((c: number[]) => !isNaN(c[0]) && !isNaN(c[1]));
        if (coords.length >= 3) {
          const polygon = new window.google.maps.Polygon({
            paths: coords.map((c: number[]) => ({ lat: c[1], lng: c[0] })),
            map: mapInstance,
            strokeColor: '#ef4444',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#ef4444',
            fillOpacity: 0.3,
          });
          overlaysRef.current.push(polygon);
        }
      });
    } catch (error) {
      console.error('High-risk areas error:', error);
    }
  };

  const geocodeLocation = async (location: string) => {
    const cacheKey = `geocode-${location}`;
    if (cacheRef.current.has(cacheKey)) return cacheRef.current.get(cacheKey);

    try {
      const response = await fetch(`/api/location-lookup?q=${encodeURIComponent(location)}`);
      const data = await response.json();
      const firstResult = Array.isArray(data?.results) ? data.results[0] : null;
      if (firstResult?.coordinates?.length >= 2) {
        const [lng, lat] = firstResult.coordinates;
        const result = { lat, lng };
        cacheRef.current.set(cacheKey, result);
        return result;
      }
      cacheRef.current.set(cacheKey, null);
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  if (!origin && !destination && !selectedClient?.coordinates) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Select a client or set loading and drop-off locations to preview route</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Route Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          ref={mapContainer} 
          className="w-full h-96 rounded-lg border"
          style={{ minHeight: '384px' }}
        />
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Loading: {origin}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Drop-off: {destination}</span>
            </div>
            {Array.isArray(stopPoints) && stopPoints.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Stop Points: {stopPoints.length} zones</span>
              </div>
            )}
            {selectedClient && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>Client: {selectedClient.name}{selectedClient?.coordinates ? ' (geozone)' : ''}</span>
              </div>
            )}
            {driverLocation && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Driver: {driverLocation.name}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Main Route (Mapbox)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full opacity-60"></div>
              <span>High-Risk Areas</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Live Traffic</span>
            </div>
            {selectedClient?.coordinates && (() => { try { const p = JSON.parse(selectedClient.coordinates); return Array.isArray(p) && p.length >= 3 } catch { return false } })() && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-500 rounded-full opacity-40"></div>
                <span>Client Geozone</span>
              </div>
            )}
          </div>

          {Array.isArray(stopPoints) && stopPoints.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Stop Points:</h4>
              <div className="flex flex-wrap gap-2">
                {stopPoints.map((point, index) => (
                  <span 
                    key={point.id} 
                    className="px-2 py-1 text-xs rounded"
                    style={{ 
                      backgroundColor: point.sourceType === 'fuel_stop' ? '#dcfce7' : `hsl(${(index * 60) % 360}, 70%, 90%)`,
                      color: point.sourceType === 'fuel_stop' ? '#166534' : `hsl(${(index * 60) % 360}, 70%, 30%)`
                    }}
                  >
                    {point.name}{point.sourceType === 'fuel_stop' ? ' • Fuel Stop' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
