/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useId, useMemo, useRef } from 'react'
import { MapPin } from 'lucide-react'

type RoutePoint = {
  lat?: number
  lng?: number
  latitude?: number
  longitude?: number
  datetime?: string
  timestamp?: string
  speed?: number
  plate?: string
}

type NormalizedPoint = {
  lat: number
  lng: number
  datetime: string | null
  speed: number | null
  plate: string | null
}

const MAPBOX_SCRIPT_ID = 'audit-trip-route-mapbox-js'
const MAPBOX_STYLE_ID = 'audit-trip-route-mapbox-css'

const formatDateTime = (value: string | null) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizePoints = (routePoints: string | RoutePoint[] | null | undefined): NormalizedPoint[] => {
  if (!routePoints) return []

  try {
    const raw =
      typeof routePoints === 'string' ? JSON.parse(routePoints.replace(/&quot;/g, '"')) : routePoints

    if (!Array.isArray(raw)) return []

    return raw
      .map((point) => {
        const lat = Number(point?.lat ?? point?.latitude)
        const lng = Number(point?.lng ?? point?.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

        return {
          lat,
          lng,
          datetime: point?.datetime || point?.timestamp || null,
          speed: Number.isFinite(Number(point?.speed)) ? Number(point?.speed) : null,
          plate: point?.plate ? String(point.plate) : null,
        }
      })
      .filter(Boolean) as NormalizedPoint[]
  } catch (error) {
    console.error('Error parsing route points:', error)
    return []
  }
}

const ensureMapboxAssets = async () => {
  if ((window as any).mapboxgl) return (window as any).mapboxgl

  if (!document.getElementById(MAPBOX_STYLE_ID)) {
    const link = document.createElement('link')
    link.id = MAPBOX_STYLE_ID
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }

  const existingScript = document.getElementById(MAPBOX_SCRIPT_ID) as HTMLScriptElement | null
  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      if ((window as any).mapboxgl) {
        resolve()
        return
      }
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Mapbox script')), {
        once: true,
      })
    })
    return (window as any).mapboxgl
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = MAPBOX_SCRIPT_ID
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Mapbox script'))
    document.head.appendChild(script)
  })

  return (window as any).mapboxgl
}

export default function TripRouteMap({
  routePoints,
}: {
  routePoints: string | RoutePoint[] | null | undefined
}) {
  const mapId = useId().replace(/:/g, '')
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const points = useMemo(() => normalizePoints(routePoints), [routePoints])
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  useEffect(() => {
    if (!points.length || !mapboxToken) return

    let mounted = true

    const renderMap = async () => {
      const mapboxgl = await ensureMapboxAssets()
      if (!mounted || !mapboxgl) return

      mapboxgl.accessToken = mapboxToken

      if (!mapRef.current) {
        mapRef.current = new mapboxgl.Map({
          container: mapId,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [points[0].lng, points[0].lat],
          zoom: 6,
          attributionControl: true,
        })

        mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
      }

      const map = mapRef.current
      const routeFeature = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: points.map((point) => [point.lng, point.lat]),
        },
      }

      const onLoad = () => {
        if (map.getSource('trip-route')) {
          ;(map.getSource('trip-route') as any).setData(routeFeature)
        } else {
          map.addSource('trip-route', {
            type: 'geojson',
            data: routeFeature,
          })

          map.addLayer({
            id: 'trip-route-line-shadow',
            type: 'line',
            source: 'trip-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#93c5fd',
              'line-width': 8,
              'line-opacity': 0.35,
            },
          })

          map.addLayer({
            id: 'trip-route-line',
            type: 'line',
            source: 'trip-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#001e42',
              'line-width': 4,
            },
          })
        }

        if (map.getSource('trip-route-points')) {
          ;(map.getSource('trip-route-points') as any).setData({
            type: 'FeatureCollection',
            features: points.slice(1, -1).map((point) => ({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [point.lng, point.lat],
              },
            })),
          })
        } else {
          map.addSource('trip-route-points', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: points.slice(1, -1).map((point) => ({
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Point',
                  coordinates: [point.lng, point.lat],
                },
              })),
            },
          })

          map.addLayer({
            id: 'trip-route-points-layer',
            type: 'circle',
            source: 'trip-route-points',
            paint: {
              'circle-radius': 3,
              'circle-color': '#2563eb',
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff',
            },
          })
        }

        markersRef.current.forEach((marker) => marker.remove())
        markersRef.current = []

        const startPoint = points[0]
        const endPoint = points[points.length - 1]

        const startMarker = new mapboxgl.Marker({ color: '#10b981' })
          .setLngLat([startPoint.lng, startPoint.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 18 }).setHTML(
              `<div><strong>Start</strong><br/>${formatDateTime(startPoint.datetime)}${
                startPoint.plate ? `<br/>${startPoint.plate}` : ''
              }</div>`
            )
          )
          .addTo(map)

        const endMarker = new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat([endPoint.lng, endPoint.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 18 }).setHTML(
              `<div><strong>End</strong><br/>${formatDateTime(endPoint.datetime)}${
                endPoint.speed != null ? `<br/>Speed ${endPoint.speed} km/h` : ''
              }</div>`
            )
          )
          .addTo(map)

        markersRef.current = [startMarker, endMarker]

        const bounds = new mapboxgl.LngLatBounds()
        points.forEach((point) => bounds.extend([point.lng, point.lat]))
        map.fitBounds(bounds, { padding: 48, duration: 900, maxZoom: 14 })
      }

      if (map.loaded()) {
        onLoad()
      } else {
        map.once('load', onLoad)
      }
    }

    renderMap().catch((error) => {
      console.error('Error rendering trip route map:', error)
    })

    return () => {
      mounted = false
    }
  }, [mapId, mapboxToken, points])

  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  if (!mapboxToken) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
        <div className="text-center text-slate-500">
          <MapPin className="mx-auto mb-2 h-10 w-10" />
          <p className="text-sm font-medium">Mapbox token is missing, so the trip route map cannot render.</p>
        </div>
      </div>
    )
  }

  if (!points.length) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
        <div className="text-center text-slate-500">
          <MapPin className="mx-auto mb-2 h-10 w-10" />
          <p className="text-sm font-medium">No route data has been captured for this trip window yet.</p>
        </div>
      </div>
    )
  }

  return <div id={mapId} className="h-[420px] w-full rounded-xl border border-slate-200" />
}
