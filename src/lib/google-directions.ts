"use server"

function getGoogleApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_TOKEN || null
}

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b: number
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)

    coords.push([lng / 1e5, lat / 1e5])
  }

  return coords
}

export async function getGoogleDirectionsByCoords(
  origin: [number, number],
  destination: [number, number]
): Promise<{
  durationSeconds: number
  distanceMeters: number
} | null> {
  const token = getGoogleApiKey()
  if (!token) return null

  try {
    const originStr = `${origin[1]},${origin[0]}`
    const destStr = `${destination[1]},${destination[0]}`
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&key=${token}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK' || !data.routes?.[0]) return null

    const leg = data.routes[0].legs[0]
    return {
      durationSeconds: leg.duration?.value || 0,
      distanceMeters: leg.distance?.value || 0,
    }
  } catch {
    return null
  }
}

export async function getGoogleRouteWithGeometry(
  origin: [number, number],
  destination: [number, number]
): Promise<{
  coordinates: [number, number][]
  durationSeconds: number
  distanceMeters: number
} | null> {
  const token = getGoogleApiKey()
  if (!token) return null

  try {
    const originStr = `${origin[1]},${origin[0]}`
    const destStr = `${destination[1]},${destination[0]}`
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&overview=full&key=${token}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK' || !data.routes?.[0]) return null

    const route = data.routes[0]
    const leg = route.legs[0]
    const coords = route.overview_polyline?.points
      ? decodePolyline(route.overview_polyline.points)
      : []

    return {
      coordinates: coords,
      durationSeconds: leg.duration?.value || 0,
      distanceMeters: leg.distance?.value || 0,
    }
  } catch {
    return null
  }
}

export async function googleGeocode(
  address: string
): Promise<{ lat: number; lng: number; formatted_address: string } | null> {
  const token = getGoogleApiKey()
  if (!token) return null

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${token}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.[0]) return null

    const result = data.results[0]
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
    }
  } catch {
    return null
  }
}
