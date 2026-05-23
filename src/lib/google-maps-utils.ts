const API_KEY = () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_TOKEN || ""

async function fetchJson(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`Google API HTTP ${res.status} for: ${url.slice(0, 120)}...`)
      return null
    }
    return await res.json()
  } catch {
    console.warn(`Google API network error (check key/restrictions): ${url.slice(0, 120)}...`)
    return null
  }
}

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; formatted_address: string } | null> {
  const data = await fetchJson(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY()}`
  )
  if (!data || data.status !== "OK" || !data.results?.[0]) return null
  const { lat, lng } = data.results[0].geometry.location
  return { lat, lng, formatted_address: data.results[0].formatted_address }
}

export async function getDirections(
  origin: string,
  destination: string
): Promise<{
  coordinates: [number, number][]
  durationSeconds: number
  distanceMeters: number
} | null> {
  const data = await fetchJson(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${API_KEY()}`
  )
  if (!data || data.status !== "OK" || !data.routes?.[0]?.legs?.[0]) return null

  const leg = data.routes[0].legs[0]
  const coordinates: [number, number][] =
    data.routes[0].overview_polyline?.points
      ? decodePolyline(data.routes[0].overview_polyline.points)
      : []

  return {
    coordinates,
    durationSeconds: leg.duration?.value || 0,
    distanceMeters: leg.distance?.value || 0,
  }
}

export async function getDirectionsByCoords(
  origin: [number, number],
  destination: [number, number]
): Promise<{
  coordinates: [number, number][]
  durationSeconds: number
  distanceMeters: number
} | null> {
  const data = await fetchJson(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin[1]},${origin[0]}&destination=${destination[1]},${destination[0]}&key=${API_KEY()}`
  )
  if (!data || data.status !== "OK" || !data.routes?.[0]?.legs?.[0]) return null

  const leg = data.routes[0].legs[0]
  const coordinates: [number, number][] =
    data.routes[0].overview_polyline?.points
      ? decodePolyline(data.routes[0].overview_polyline.points)
      : []

  return {
    coordinates,
    durationSeconds: leg.duration?.value || 0,
    distanceMeters: leg.distance?.value || 0,
  }
}

export async function getDistanceMatrix(
  origins: [number, number][],
  destinations: [number, number][]
): Promise<{ durationSeconds: number; distanceMeters: number } | null> {
  const originsStr = origins.map((o) => `${o[1]},${o[0]}`).join("|")
  const destsStr = destinations.map((d) => `${d[1]},${d[0]}`).join("|")
  const data = await fetchJson(
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destsStr}&key=${API_KEY()}`
  )
  if (!data || data.status !== "OK") return null
  const element = data.rows?.[0]?.elements?.[0]
  if (!element || element.status !== "OK") return null
  return {
    durationSeconds: element.duration?.value || 0,
    distanceMeters: element.distance?.value || 0,
  }
}

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    coords.push([lng / 1e5, lat / 1e5])
  }
  return coords
}
