import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.EPS_DASHBOARD_BASE_URL || 'http://167.71.48.108:8800'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const endpoint = path.join('/')
  const url = `${BASE_URL}/api/dashboard/${endpoint}`

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Proxy error' }, { status: 500 })
  }
}
