"use server"

export async function getGoogleDirectionsByCoords(
  origin: [number, number],
  destination: [number, number]
): Promise<{
  durationSeconds: number
  distanceMeters: number
} | null> {
  try {
    const endpoint = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin[1]},${origin[0]}&destination=${destination[1]},${destination[0]}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_TOKEN}`
    const res = await fetch(endpoint, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes?.[0]) return null

    const leg = data.routes[0].legs[0]
    return {
      durationSeconds: leg.duration?.value || 0,
      distanceMeters: leg.distance?.value || 0,
    }
  } catch {
    return null
  }
}

export async function getGoogleDirectionsByAddress(
  origin: string,
  destination: string
): Promise<{
  durationSeconds: number
  distanceMeters: number
  originCoords?: [number, number]
  destCoords?: [number, number]
} | null> {
  try {
    const endpoint = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_TOKEN}`
    const res = await fetch(endpoint, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes?.[0]) return null

    const leg = data.routes[0].legs[0]
    return {
      durationSeconds: leg.duration?.value || 0,
      distanceMeters: leg.distance?.value || 0,
      originCoords: leg.start_location ? [leg.start_location.lng, leg.start_location.lat] : undefined,
      destCoords: leg.end_location ? [leg.end_location.lng, leg.end_location.lat] : undefined,
    }
  } catch {
    return null
  }
}
