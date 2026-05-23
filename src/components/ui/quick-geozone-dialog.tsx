"use client"

import { useEffect, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X, Loader2, RotateCcw, Trash2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGoogleMaps } from "@/hooks/use-google-maps"
import { toast } from "sonner"

type Point = { lng: number; lat: number }

interface QuickGeozoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: any
  onSaved: () => void
}

function QuickGeozoneDialogContent({ client, onSaved, onOpenChange }: { client: any; onSaved: () => void; onOpenChange: (open: boolean) => void }) {
  const { loaded: mapsLoaded, error: mapsError } = useGoogleMaps()
  const [centerPoint, setCenterPoint] = useState<Point | null>(null)
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([])
  const [drawMode, setDrawMode] = useState<"station" | "polygon">("polygon")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const drawModeRef = useRef(drawMode)
  const centerPointRef = useRef<Point | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const centerMarkerRef = useRef<google.maps.Marker | null>(null)
  const overlaysRef = useRef<(google.maps.Polygon | google.maps.Polyline | google.maps.Marker)[]>([])
  const geocodeRef = useRef<google.maps.Geocoder | null>(null)
  const placesServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const searchMarkerRef = useRef<google.maps.Marker | null>(null)

  useEffect(() => { drawModeRef.current = drawMode }, [drawMode])
  useEffect(() => { centerPointRef.current = centerPoint }, [centerPoint])

  const clearOverlays = () => {
    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
  }

  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current || mapRef.current) return
    mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      center: { lat: -26.2041, lng: 28.0473 },
      zoom: 4.8,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    mapRef.current.addListener("click", (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return
      const clickLat = Number(event.latLng.lat().toFixed(6))
      const clickLng = Number(event.latLng.lng().toFixed(6))
      const clickedPoint = { lng: clickLng, lat: clickLat }

      if (!centerPointRef.current) {
        setCenterPoint(clickedPoint)
        setDrawMode("polygon")
        return
      }
      setPolygonPoints((prev) => [...prev, clickedPoint])
    })
    placesServiceRef.current = new google.maps.places.AutocompleteService()
  }, [mapsLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapsLoaded) return
    if (centerMarkerRef.current) { centerMarkerRef.current.setMap(null); centerMarkerRef.current = null }
    if (centerPoint) {
      centerMarkerRef.current = new google.maps.Marker({
        position: { lat: centerPoint.lat, lng: centerPoint.lng },
        map,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#dc2626", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 },
      })
      map.setCenter({ lat: centerPoint.lat, lng: centerPoint.lng })
      map.setZoom(12)
    }
  }, [centerPoint, mapsLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapsLoaded) return
    clearOverlays()
    if (polygonPoints.length === 0) return

    polygonPoints.forEach((point, index) => {
      const marker = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map,
        label: { text: String(index + 1), color: "#1d4ed8", fontSize: "11px", fontWeight: "bold" },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: "#ffffff", fillOpacity: 1, strokeColor: "#1d4ed8", strokeWeight: 2 },
      })
      overlaysRef.current.push(marker as any)
    })

    const path = polygonPoints.map((p) => ({ lat: p.lat, lng: p.lng }))
    if (polygonPoints.length >= 2) {
      overlaysRef.current.push(new google.maps.Polyline({ path, map, strokeColor: "#2563eb", strokeWeight: 2, strokeOpacity: 0.8 }) as any)
    }
    if (polygonPoints.length >= 3) {
      overlaysRef.current.push(new google.maps.Polygon({ paths: path, map, fillColor: "#2563eb", fillOpacity: 0.18, strokeColor: "#1d4ed8", strokeWeight: 3 }) as any)
    }
  }, [polygonPoints, mapsLoaded])

  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!value.trim() || !placesServiceRef.current) {
      setSuggestions([])
      return
    }
    searchTimeoutRef.current = setTimeout(() => {
      placesServiceRef.current!.getPlacePredictions(
        { input: value, types: ["geocode", "establishment"] },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions)
          } else {
            setSuggestions([])
          }
        }
      )
    }, 300)
  }

  const handleSelectSuggestion = (placeId: string, description: string) => {
    setSearchQuery(description)
    setSuggestions([])
    const placesService = new google.maps.places.PlacesService(document.createElement("div"))
    placesService.getDetails({ placeId }, (place, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) return
      const lat = place.geometry.location.lat()
      const lng = place.geometry.location.lng()
      const map = mapRef.current
      if (!map) return
      if (searchMarkerRef.current) searchMarkerRef.current.setMap(null)
      searchMarkerRef.current = new google.maps.Marker({
        position: { lat, lng },
        map,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#f59e0b", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 },
      })
      map.setCenter({ lat, lng })
      map.setZoom(12)
    })
  }

  const handleSave = async () => {
    if (!centerPoint || polygonPoints.length < 3) {
      setError("Place a station point and draw at least 3 polygon points.")
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const polygon = polygonPoints.map((p) => [p.lng, p.lat])
      const res = await fetch("/api/eps-client-list", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: client.id,
          name: client.name,
          client_id: client.client_id,
          coordinates: JSON.stringify(polygon),
          coords: `${centerPoint.lat},${centerPoint.lng}`,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to save geozone")
      toast.success("Geozone saved for " + (client.name || client.client_id))
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      console.error("Failed to save geozone:", err)
      setError(err?.message || "Failed to save geozone")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col overflow-hidden">
      <div className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Set Geozone for {client?.name}</h1>
        <p className="text-sm text-slate-500">Search for a location, then click the map to set station point and draw the zone around the area.</p>
      </div>
      <div className="flex-1 p-6 space-y-4">
        {mapsError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Map failed to load: {mapsError}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search for a location..."
            className="pl-9"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  onClick={() => handleSelectSuggestion(s.place_id, s.description)}
                >
                  {s.description}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Geozone Editor</div>
              <div className="text-xs text-slate-500">
                Set the station point first, then switch to polygon mode and click around the area to create the zone.
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant={drawMode === "station" ? "default" : "outline"} size="sm" onClick={() => setDrawMode("station")}>Station Point</Button>
              <Button type="button" variant={drawMode === "polygon" ? "default" : "outline"} size="sm" onClick={() => setDrawMode("polygon")} disabled={!centerPoint}>Draw Zone</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPolygonPoints((prev) => prev.slice(0, -1))} disabled={polygonPoints.length === 0}>
                <RotateCcw className="mr-1 h-4 w-4" /> Undo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setCenterPoint(null); setPolygonPoints([]) }}>
                <Trash2 className="mr-1 h-4 w-4" /> Clear
              </Button>
            </div>
          </div>
          <div ref={mapContainerRef} className="h-[450px] w-full rounded-xl border border-slate-200" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Station Point</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {centerPoint ? `${centerPoint.lat.toFixed(5)}, ${centerPoint.lng.toFixed(5)}` : "Not set"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Polygon Points</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{polygonPoints.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Mode</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{drawMode === "station" ? "Setting station point" : "Drawing polygon zone"}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Client</div>
            <div className="mt-1 text-sm font-medium text-slate-900 truncate">{client?.name || client?.client_id}</div>
          </div>
        </div>
      </div>
      <div className="flex justify-between border-t border-slate-200 px-6 py-4">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Skip - Enter Manually</Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !centerPoint || polygonPoints.length < 3}>
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Geozone"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function QuickGeozoneDialog({ open, onOpenChange, client, onSaved }: QuickGeozoneDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-[95vw] h-[95vh] bg-white shadow-xl border border-gray-200 rounded-lg overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <DialogPrimitive.Title className="sr-only">Add Geozone for {client?.name}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2">
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
          {open && <QuickGeozoneDialogContent client={client} onSaved={onSaved} onOpenChange={onOpenChange} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
