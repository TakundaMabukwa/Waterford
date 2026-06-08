import { NextRequest, NextResponse } from 'next/server'

const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving'

export async function POST(request: NextRequest) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  if (!token) {
    return NextResponse.json({ error: 'MAPBOX_TOKEN not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { origin, destination, intermediates = [] } = body

    if (!origin || !destination) {
      return NextResponse.json({ error: 'origin and destination are required' }, { status: 400 })
    }

    // Mapbox uses lng,lat order separated by semicolons
    const coords = [
      `${origin.lng},${origin.lat}`,
      ...intermediates.map((i: any) => `${i.lng},${i.lat}`),
      `${destination.lng},${destination.lat}`,
    ].join(';')

    const url = `${MAPBOX_DIRECTIONS_URL}/${coords}?geometries=geojson&overview=full&steps=false&access_token=${token}`

    console.log('[mapbox-route] fetching waypoints:', intermediates.length + 2, 'points')

    const response = await fetch(url, { cache: 'no-store' })

    if (!response.ok) {
      const text = await response.text()
      console.error('[mapbox-route] API error:', response.status, text)
      return NextResponse.json({ error: `Mapbox request failed: ${response.status}` }, { status: response.status })
    }

    const data = await response.json()

    if (!data.routes?.length) {
      console.error('[mapbox-route] No route found:', data)
      return NextResponse.json({ error: 'No route found' }, { status: 404 })
    }

    const route = data.routes[0]

    // Mapbox response is already in OSRM-compatible format
    return NextResponse.json({
      code: 'Ok',
      routes: [
        {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
        },
      ],
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Mapbox request failed'
    console.error('[mapbox-route] Proxy error:', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
