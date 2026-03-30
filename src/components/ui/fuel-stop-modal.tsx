/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Plus, RotateCcw, Trash2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LocationAutocomplete } from '@/components/ui/location-autocomplete'

type Point = { lng: number; lat: number }

const MAPBOX_SCRIPT_ID = 'fuel-stop-mapbox-js'
const MAPBOX_STYLE_ID = 'fuel-stop-mapbox-css'

const parseContextValue = (feature: any, prefix: string) =>
  feature?.context?.find((item: any) => String(item.id || '').startsWith(prefix))?.text || ''

const ensureMapboxAssets = async () => {
  if ((window as any).mapboxgl) return (window as any).mapboxgl

  if (!document.getElementById(MAPBOX_STYLE_ID)) {
    const link = document.createElement('link')
    link.id = MAPBOX_STYLE_ID
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }

  if (document.getElementById(MAPBOX_SCRIPT_ID)) {
    await new Promise<void>((resolve, reject) => {
      const script = document.getElementById(MAPBOX_SCRIPT_ID) as HTMLScriptElement
      if ((window as any).mapboxgl) {
        resolve()
        return
      }
      script.addEventListener('load', () => resolve(), { once: true })
      script.addEventListener('error', () => reject(new Error('Failed to load Mapbox')), { once: true })
    })
    return (window as any).mapboxgl
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = MAPBOX_SCRIPT_ID
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Mapbox'))
    document.head.appendChild(script)
  })

  return (window as any).mapboxgl
}

export function FuelStopForm({
  title = 'Fuel Station And Geozone',
  showBackButton = false,
  backLabel = 'Back',
  onCancel,
  onSaved,
}: {
  title?: string
  showBackButton?: boolean
  backLabel?: string
  onCancel?: () => void
  onSaved?: (record: any) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const centerMarkerRef = useRef<any>(null)
  const drawModeRef = useRef<'station' | 'polygon'>('station')
  const centerPointRef = useRef<Point | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [name, setName] = useState('')
  const [geozoneName, setGeozoneName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [fuelPrice, setFuelPrice] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [operatingHours, setOperatingHours] = useState('')
  const [notes, setNotes] = useState('')
  const [facilities, setFacilities] = useState('')
  const [centerPoint, setCenterPoint] = useState<Point | null>(null)
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([])
  const [drawMode, setDrawMode] = useState<'station' | 'polygon'>('station')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    drawModeRef.current = drawMode
  }, [drawMode])

  useEffect(() => {
    centerPointRef.current = centerPoint
  }, [centerPoint])

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      const mapboxgl = await ensureMapboxAssets()
      if (!mounted || !mapContainerRef.current || !mapboxgl) return
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

      if (!mapRef.current) {
        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [28.0473, -26.2041],
          zoom: 4.8,
        })
        mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')

        mapRef.current.on('load', () => {
          if (!mapRef.current.getSource('fuel-stop-geozone')) {
            mapRef.current.addSource('fuel-stop-geozone', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [],
              },
            })

            mapRef.current.addLayer({
              id: 'fuel-stop-geozone-fill',
              type: 'fill',
              source: 'fuel-stop-geozone',
              paint: {
                'fill-color': '#2563eb',
                'fill-opacity': 0.18,
              },
            })

            mapRef.current.addLayer({
              id: 'fuel-stop-geozone-outline',
              type: 'line',
              source: 'fuel-stop-geozone',
              filter: ['==', ['geometry-type'], 'Polygon'],
              paint: {
                'line-color': '#1d4ed8',
                'line-width': 3,
              },
            })

            mapRef.current.addLayer({
              id: 'fuel-stop-geozone-path',
              type: 'line',
              source: 'fuel-stop-geozone',
              filter: ['==', ['geometry-type'], 'LineString'],
              paint: {
                'line-color': '#2563eb',
                'line-width': 2,
                'line-dasharray': [2, 2],
              },
            })

            mapRef.current.addLayer({
              id: 'fuel-stop-geozone-points',
              type: 'circle',
              source: 'fuel-stop-geozone',
              filter: ['==', ['geometry-type'], 'Point'],
              paint: {
                'circle-radius': 5,
                'circle-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#1d4ed8',
              },
            })
          }
        })

        mapRef.current.on('click', (event: any) => {
          const clickedPoint = {
            lng: Number(event.lngLat.lng.toFixed(6)),
            lat: Number(event.lngLat.lat.toFixed(6)),
          }

          if (drawModeRef.current === 'station' || !centerPointRef.current) {
            setCenterPoint(clickedPoint)
            setLocationQuery(`${clickedPoint.lat}, ${clickedPoint.lng}`)
            if (!name) {
              setName('Fuel Station')
            }
            if (!geozoneName) {
              setGeozoneName('Fuel Station Zone')
            }
            return
          }

          setPolygonPoints((prev) => [...prev, clickedPoint])
        })
      }
    }

    initialize().catch((mapError) => {
      console.error('Error initialising fuel stop map:', mapError)
      setError('Map failed to load')
    })

    return () => {
      mounted = false
    }
  }, [geozoneName, name])

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl) return

    if (centerMarkerRef.current) {
      centerMarkerRef.current.remove()
      centerMarkerRef.current = null
    }

    if (centerPoint) {
      centerMarkerRef.current = new mapboxgl.Marker({ color: '#dc2626' })
        .setLngLat([centerPoint.lng, centerPoint.lat])
        .addTo(map)
      map.flyTo({ center: [centerPoint.lng, centerPoint.lat], zoom: 12, essential: true })
    }

    if (!map.getSource('fuel-stop-geozone')) return

    const closedPolygon = polygonPoints.length >= 3 ? [...polygonPoints, polygonPoints[0]].map((point) => [point.lng, point.lat]) : []
    const polygonPath = polygonPoints.length >= 2 ? polygonPoints.map((point) => [point.lng, point.lat]) : []
    const vertexFeatures = polygonPoints.map((point, index) => ({
      type: 'Feature',
      properties: { index: index + 1 },
      geometry: {
        type: 'Point',
        coordinates: [point.lng, point.lat],
      },
    }))

    ;(map.getSource('fuel-stop-geozone') as any).setData({
      type: 'FeatureCollection',
      features: [
        ...vertexFeatures,
        ...(polygonPath.length
          ? [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: polygonPath,
              },
            },
          ]
          : []),
        ...(closedPolygon.length
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Polygon',
                  coordinates: [closedPolygon],
                },
              },
            ]
          : []),
      ],
    })
  }, [centerPoint, polygonPoints])

  const handleLocate = async () => {
    if (!locationQuery) return
    setIsLocating(true)
    setError(null)

    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          locationQuery
        )}.json?access_token=${token}&limit=1&autocomplete=false&types=country,region,postcode,district,place,locality,neighborhood,address,poi`
      )
      const data = await response.json()
      const feature = Array.isArray(data?.features) ? data.features[0] : null
      if (!feature?.center) {
        throw new Error('Location not found')
      }

      const [lng, lat] = feature.center
      setCenterPoint({ lng, lat })
      setDrawMode('polygon')
      setAddress(feature.place_name || '')
      setCity(parseContextValue(feature, 'place'))
      setState(parseContextValue(feature, 'region'))
      setCountry(parseContextValue(feature, 'country'))
      if (!name) {
        setName(feature.text || 'Fuel Stop')
      }
      if (!geozoneName) {
        setGeozoneName(feature.text || 'Fuel Stop Zone')
      }
    } catch (locateError: any) {
      console.error('Fuel stop geocode error:', locateError)
      setError(locateError?.message || 'Failed to locate fuel station')
    } finally {
      setIsLocating(false)
    }
  }

  const resetForm = () => {
    setLocationQuery('')
    setName('')
    setGeozoneName('')
    setAddress('')
    setCity('')
    setState('')
    setCountry('')
    setFuelPrice('')
    setContactPerson('')
    setContactPhone('')
    setContactEmail('')
    setOperatingHours('')
    setNotes('')
    setFacilities('')
    setCenterPoint(null)
    setPolygonPoints([])
    setDrawMode('station')
    setError(null)
  }

  const handleSave = async () => {
    if (!name || !centerPoint) {
      setError('Name and station location are required.')
      return
    }
    if (polygonPoints.length < 3) {
      setError('Please draw at least 3 points for the geozone area.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const polygon = polygonPoints.map((point) => [point.lng, point.lat])
      const payload = {
        name,
        name2: name,
        type: 'fuel_station',
        address,
        city,
        state,
        country,
        coords: `${centerPoint.lat},${centerPoint.lng}`,
        coordinates: JSON.stringify(polygon),
        geozone_coordinates: polygon,
        location_coordinates: { lat: centerPoint.lat, lng: centerPoint.lng },
        geozone_name: geozoneName || name,
        fuel_price_per_liter: fuelPrice ? Number(fuelPrice) : null,
        value: fuelPrice || null,
        contact_person: contactPerson || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        operating_hours: operatingHours || null,
        notes: notes || null,
        facilities: facilities
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        updated_at: new Date().toISOString(),
      }

      const { data, error: saveError } = await supabase.from('fuel_stops').insert(payload).select('*').single()
      if (saveError) throw saveError

      onSaved?.(data)
      resetForm()
    } catch (saveError: any) {
      console.error('Error saving fuel stop:', saveError)
      setError(saveError?.message || 'Failed to save fuel stop')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          {showBackButton ? (
            <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500">Save a fuel station point, fuel price, and polygon geozone area.</p>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-5 overflow-hidden px-6 py-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Search Location</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <LocationAutocomplete value={locationQuery} onChange={setLocationQuery} placeholder="Search a fuel station or address" />
                  </div>
                  <Button type="button" variant="outline" onClick={handleLocate} disabled={isLocating}>
                    {isLocating ? 'Locating...' : 'Locate'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Station Name</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Fuel station name" />
              </div>
              <div className="space-y-2">
                <Label>Geozone Name</Label>
                <Input value={geozoneName} onChange={(event) => setGeozoneName(event.target.value)} placeholder="Fuel station geozone" />
              </div>
              <div className="space-y-2">
                <Label>Fuel Price Per Liter</Label>
                <Input value={fuelPrice} onChange={(event) => setFuelPrice(event.target.value)} placeholder="9.67" type="number" step="0.01" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Full address" />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(event) => setCity(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>State / Province</Label>
                <Input value={state} onChange={(event) => setState(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={country} onChange={(event) => setCountry(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Operating Hours</Label>
                <Input value={operatingHours} onChange={(event) => setOperatingHours(event.target.value)} placeholder="24/7" />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Contact Email</Label>
                <Input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Facilities</Label>
                <Input value={facilities} onChange={(event) => setFacilities(event.target.value)} placeholder="Showers, parking, food, diesel" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything useful about this station or area" rows={3} />
              </div>
            </div>

            {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          </div>

          <div className="space-y-3 overflow-y-auto">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Geozone Editor</div>
                  <div className="text-xs text-slate-500">
                    Set the station point first, then switch to polygon mode and click around the area to create the zone.
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={drawMode === 'station' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDrawMode('station')}
                  >
                    Station Point
                  </Button>
                  <Button
                    type="button"
                    variant={drawMode === 'polygon' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDrawMode('polygon')}
                    disabled={!centerPoint}
                  >
                    Draw Zone
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPolygonPoints((prev) => prev.slice(0, -1))} disabled={polygonPoints.length === 0}>
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Undo
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setCenterPoint(null); setPolygonPoints([]) }}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>

              <div ref={mapContainerRef} className="h-[420px] w-full rounded-xl border border-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Station Point</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {centerPoint ? `${centerPoint.lat.toFixed(5)}, ${centerPoint.lng.toFixed(5)}` : 'Not set'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Polygon Points</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{polygonPoints.length}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Mode</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{drawMode === 'station' ? 'Setting station point' : 'Drawing polygon zone'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Type</div>
                <div className="mt-1 text-sm font-medium text-slate-900">Fuel Station</div>
              </div>
            </div>
          </div>
        </div>

      <div className="flex justify-between border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="ghost" onClick={resetForm}>
            <Plus className="mr-2 h-4 w-4" />
            Reset Form
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {backLabel}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Fuel Station'}
            </Button>
          </div>
      </div>
    </div>
  )
}
