"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useGoogleMaps } from "@/hooks/use-google-maps"
import { Sun, Moon, Crosshair, Maximize } from "lucide-react"

declare global {
  interface Window {
    google: typeof google
  }
}

interface GoogleMapViewProps {
  mapData: any
}

const DAY_STYLE: google.maps.MapTypeStyle[] = []
const NIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#283d55" }],
  },
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b7894" }],
  },
]

function lngLatToLatLng(coord: [number, number]): google.maps.LatLngLiteral {
  return { lat: coord[1], lng: coord[0] }
}

export default function GoogleMapView({ mapData }: GoogleMapViewProps) {
  const { loaded, error: loadError } = useGoogleMaps()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const [isNightMode, setIsNightMode] = useState(true)

  const getCenter = useCallback(() => {
    if (mapData.longitude && mapData.latitude) {
      return { lat: parseFloat(mapData.latitude), lng: parseFloat(mapData.longitude) }
    }
    return { lat: -26.2041, lng: 28.0473 }
  }, [mapData])

  const zoomToDriver = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (mapData.longitude && mapData.latitude) {
      map.setCenter({ lat: parseFloat(mapData.latitude), lng: parseFloat(mapData.longitude) })
      map.setZoom(15)
    }
  }, [mapData])

  const zoomToRoute = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    if (mapData.longitude && mapData.latitude) {
      bounds.extend({ lat: parseFloat(mapData.latitude), lng: parseFloat(mapData.longitude) })
      hasPoints = true
    }

    if (mapData.routeCoordinates?.length) {
      mapData.routeCoordinates.forEach((c: [number, number]) => {
        bounds.extend(lngLatToLatLng(c))
        hasPoints = true
      })
    }

    if (mapData.highRiskZones?.length) {
      mapData.highRiskZones.forEach((area: any) => {
        area.polygon?.forEach((c: [number, number]) => {
          bounds.extend(lngLatToLatLng(c))
          hasPoints = true
        })
      })
    }

    if (mapData.fuelStopZones?.length) {
      mapData.fuelStopZones.forEach((fs: any) => {
        if (fs.center) bounds.extend(lngLatToLatLng(fs.center))
        fs.polygon?.forEach((c: [number, number]) => bounds.extend(lngLatToLatLng(c)))
        hasPoints = true
      })
    }

    if (mapData.stopPoints?.length) {
      mapData.stopPoints.forEach((sp: any) => {
        if (sp.coordinates) bounds.extend(lngLatToLatLng(sp.coordinates))
        hasPoints = true
      })
    }

    if (hasPoints) {
      map.fitBounds(bounds, 50)
    } else {
      map.setZoom(10)
    }
  }, [mapData])

  useEffect(() => {
    if (!loaded || !mapRef.current || !mapData) return

    const defaultStyles = NIGHT_STYLE

    const map = new window.google.maps.Map(mapRef.current, {
      center: getCenter(),
      zoom: mapData.showBasicRoute ? 10 : 15,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: defaultStyles,
    })

    mapInstanceRef.current = map
    const bounds = new window.google.maps.LatLngBounds()
    bounds.extend(getCenter())

    let vehicleMarker: google.maps.Marker | null = null

    if (!mapData.showRouteOnly && !mapData.showBasicRoute && mapData.longitude && mapData.latitude) {
      const vehiclePos = { lat: parseFloat(mapData.latitude), lng: parseFloat(mapData.longitude) }

      vehicleMarker = new window.google.maps.Marker({
        position: vehiclePos,
        map,
        title: mapData.driverDetails?.fullName || "Vehicle",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      })

      if (mapData.driverDetails) {
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding:8px;">
              <div style="font-weight:bold;color:#1e3a5f;margin-bottom:8px;">${mapData.driverDetails.fullName}</div>
              <div style="font-size:13px;">
                <div><strong>Vehicle:</strong> ${mapData.driverDetails.plate}</div>
                <div><strong>Speed:</strong> ${mapData.driverDetails.speed} km/h</div>
                <div><strong>Company:</strong> ${mapData.driverDetails.company || "N/A"}</div>
                <div style="font-size:11px;color:#666;margin-top:8px;">
                  Last updated: ${new Date(mapData.driverDetails.lastUpdate).toLocaleTimeString()}
                </div>
              </div>
            </div>
          `,
        })
        vehicleMarker.addListener("click", () => infoWindow.open(map, vehicleMarker))
        infoWindow.open(map, vehicleMarker)
      }
    }

    if (mapData.routeCoordinates?.length > 1) {
      const routePath = mapData.routeCoordinates.map(lngLatToLatLng)
      routePath.forEach((p) => bounds.extend(p))

      new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: "#ef4444",
        strokeOpacity: 1.0,
        strokeWeight: 4,
        map,
      })

      new window.google.maps.Marker({
        position: routePath[0],
        map,
        title: "Start",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      })

      new window.google.maps.Marker({
        position: routePath[routePath.length - 1],
        map,
        title: "Destination",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      })
    }

    if (mapData.highRiskZones?.length) {
      mapData.highRiskZones.forEach((area: any) => {
        if (!area.polygon || area.polygon.length < 3) return
        const paths = area.polygon.map(lngLatToLatLng)
        paths.forEach((p) => bounds.extend(p))

        new window.google.maps.Polygon({
          paths,
          map,
          strokeColor: "#dc2626",
          strokeOpacity: 0.8,
          strokeWeight: 3,
          fillColor: "#ef4444",
          fillOpacity: 0.3,
        })
      })
    }

    if (mapData.fuelStopZones?.length) {
      mapData.fuelStopZones.forEach((fuelStop: any) => {
        if (fuelStop.polygon?.length > 2) {
          const paths = fuelStop.polygon.map(lngLatToLatLng)
          paths.forEach((p) => bounds.extend(p))

          new window.google.maps.Polygon({
            paths,
            map,
            strokeColor: "#15803d",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#22c55e",
            fillOpacity: 0.18,
          })
        }

        if (fuelStop.center) {
          const centerPos = lngLatToLatLng(fuelStop.center)
          bounds.extend(centerPos)

          const marker = new window.google.maps.Marker({
            position: centerPos,
            map,
            title: fuelStop.name,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#16a34a",
              fillOpacity: 0.7,
              strokeColor: "#15803d",
              strokeWeight: 2,
            },
          })

          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="padding:8px;"><strong>${fuelStop.name}</strong><br/>Fuel Stop Zone</div>`,
          })
          marker.addListener("click", () => infoWindow.open(map, marker))
        }
      })
    }

    if (mapData.stopPoints?.length) {
      mapData.stopPoints.forEach((stopPoint: any, index: number) => {
        if (stopPoint.polygon?.length > 2) {
          const paths = stopPoint.polygon.map(lngLatToLatLng)
          paths.forEach((p) => bounds.extend(p))

          new window.google.maps.Polygon({
            paths,
            map,
            strokeColor: "#f59e0b",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#fbbf24",
            fillOpacity: 0.3,
          })
        }

        if (stopPoint.coordinates) {
          const pos = lngLatToLatLng(stopPoint.coordinates)
          bounds.extend(pos)

          const marker = new window.google.maps.Marker({
            position: pos,
            map,
            title: `Stop Point ${index + 1}`,
            label: `${index + 1}`,
          })

          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="padding:8px;"><strong>Stop Point ${index + 1}</strong><br/>${stopPoint.name || ""}</div>`,
          })
          marker.addListener("click", () => infoWindow.open(map, marker))
        }
      })
    }

    if (mapData.showBasicRoute && mapData.origin && mapData.destination) {
      const geocoder = new window.google.maps.Geocoder()
      const directionsService = new window.google.maps.DirectionsService()
      const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#3b82f6",
          strokeOpacity: 1.0,
          strokeWeight: 4,
        },
      })

      const geocode = (address: string) =>
        new Promise<google.maps.LatLng | null>((resolve) =>
          geocoder.geocode({ address }, (results, status) =>
            resolve(results?.[0]?.geometry.location || null)
          )
        )

      Promise.all([geocode(mapData.origin), geocode(mapData.destination)]).then(
        ([originLatLng, destLatLng]) => {
          if (!originLatLng || !destLatLng) return
          bounds.extend(originLatLng)
          bounds.extend(destLatLng)
          directionsService.route(
            {
              origin: originLatLng,
              destination: destLatLng,
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (status === "OK") directionsRenderer.setDirections(result)
            }
          )
        }
      )
    }

    if (bounds.isEmpty()) {
      map.setCenter(getCenter())
      map.setZoom(10)
    } else {
      map.fitBounds(bounds, 50)
    }

    return () => {
      mapInstanceRef.current = null
    }
  }, [loaded, mapData, getCenter])

  const toggleNightMode = useCallback(() => {
    setIsNightMode((prev) => {
      const next = !prev
      const map = mapInstanceRef.current
      if (map) {
        map.setOptions({ styles: next ? NIGHT_STYLE : DAY_STYLE })
      }
      return next
    })
  }, [])

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500 bg-slate-100 rounded min-h-[400px]">
        {loadError}
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 bg-slate-100 rounded min-h-[400px]">
        <div>Loading map...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 flex-1 min-h-0">
      <div className="flex-1 min-h-0 order-1 lg:order-2 relative">
        <div ref={mapRef} className="w-full h-full min-h-[400px] rounded border bg-slate-100" />

        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            onClick={zoomToDriver}
            title="Zoom to driver"
            className="w-9 h-9 bg-white rounded-md shadow-md flex items-center justify-center hover:bg-gray-50 border border-gray-200 transition-colors"
          >
            <Crosshair className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={zoomToRoute}
            title="Zoom to full route"
            className="w-9 h-9 bg-white rounded-md shadow-md flex items-center justify-center hover:bg-gray-50 border border-gray-200 transition-colors"
          >
            <Maximize className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </div>

      <div className="w-full lg:w-72 bg-gray-50 p-4 rounded-lg flex-shrink-0 max-h-64 lg:max-h-none overflow-y-auto order-2 lg:order-1">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold">Driver Information</h4>
          <button
            onClick={toggleNightMode}
            title={isNightMode ? "Switch to day mode" : "Switch to night mode"}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
          >
            {isNightMode ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>
        </div>

        {mapData?.driverDetails && (
          <div className="space-y-3 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="font-medium text-blue-900">{mapData.driverDetails.fullName}</div>
              <div className="text-blue-700 text-xs">Vehicle: {mapData.driverDetails.plate}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Speed:</span>
                <span className="font-medium">{mapData.driverDetails.speed} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Mileage:</span>
                <span className="font-medium">
                  {parseFloat(mapData.driverDetails.mileage || 0).toLocaleString()} km
                </span>
              </div>
              <div className="text-xs text-gray-500">
                <div className="font-medium mb-1">Current Location:</div>
                <div>{mapData.driverDetails.address}</div>
              </div>
              {mapData.driverDetails.geozone && (
                <div className="text-xs text-gray-500">
                  <div className="font-medium mb-1">Geozone:</div>
                  <div>{mapData.driverDetails.geozone}</div>
                </div>
              )}
              <div className="text-xs text-gray-500">
                <div className="font-medium mb-1">Last Update:</div>
                <div>
                  {mapData.driverDetails.lastUpdate
                    ? new Date(mapData.driverDetails.lastUpdate).toLocaleString()
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
