import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')
  const waypoints = searchParams.get('waypoints')

  if (!origin || !destination) {
    return NextResponse.json({ error: 'origin and destination are required' }, { status: 400 })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_TOKEN

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API token not configured' }, { status: 500 })
  }

  let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${apiKey}&departure_time=now`

  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`
  }

  try {
    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json()
    if (data.status !== 'OK') {
      console.error('[google-directions] Non-OK response:', data.status, data.error_message || '', 'origin:', origin, 'destination:', destination)
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('[google-directions] Fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Directions request failed' },
      { status: 502 }
    )
  }
}
