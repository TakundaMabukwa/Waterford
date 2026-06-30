import { NextResponse } from 'next/server'

const BASE_URL = process.env.EPS_DASHBOARD_BASE_URL || 'http://167.71.48.108:8800'

export async function GET() {
  try {
    const res = await fetch(`${BASE_URL}/api/driver`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`Driver API error: ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[api/driver] Error:', err.message)
    return NextResponse.json({ ok: false, data: [] }, { status: 500 })
  }
}
