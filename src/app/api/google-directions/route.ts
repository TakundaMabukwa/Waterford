export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')
  const token = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_TOKEN

  if (!origin || !destination || !token) {
    return Response.json({ error: 'Missing origin, destination, or token' }, { status: 400 })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${token}`
    const response = await fetch(url, { cache: 'no-store' })

    if (!response.ok) {
      return Response.json({ error: `Google API failed: ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Google Directions proxy error:', error)
    return Response.json({ error: 'Proxy request failed' }, { status: 500 })
  }
}
