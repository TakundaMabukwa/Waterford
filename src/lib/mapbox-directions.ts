"use server"

export async function getDirectionsByCoords(
  origin: [number, number],
  destination: [number, number]
): Promise<{
  coordinates: [number, number][]
  durationSeconds: number
  distanceMeters: number
} | null> {
  try {
    const endpoint = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
    const res = await fetch(
      `/api/mapbox?endpoint=${encodeURIComponent(endpoint)}&geometries=geojson&overview=full&steps=false`,
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes?.[0]) return null

    const route = data.routes[0]
    return {
      coordinates: route.geometry?.coordinates || [],
      durationSeconds: route.duration || 0,
      distanceMeters: route.distance || 0,
    }
  } catch {
    return null
  }
}

export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number; formatted_address: string } | null> {
  try {
    const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`
    const res = await fetch(
      `/api/mapbox?endpoint=${encodeURIComponent(endpoint)}&limit=1`,
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.features?.[0]) return null

    const feature = data.features[0]
    const [lng, lat] = feature.center
    return { lat, lng, formatted_address: feature.place_name }
  } catch {
    return null
  }
}
