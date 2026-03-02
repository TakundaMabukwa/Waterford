import { NextResponse } from 'next/server'

const WATERFORD_SITES_URL = 'http://209.38.217.58:8000/api/waterford-sites'

export async function GET() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    const response = await fetch(WATERFORD_SITES_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch waterford sites' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return NextResponse.json({ error: 'Waterford sites timeout' }, { status: 504 })
    }

    return NextResponse.json({ error: 'Unable to fetch waterford sites' }, { status: 500 })
  }
}
