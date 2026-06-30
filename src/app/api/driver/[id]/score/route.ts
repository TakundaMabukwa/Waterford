import { NextResponse } from 'next/server'

const BASE_URL = process.env.EPS_DASHBOARD_BASE_URL || 'http://167.71.48.108:8800'

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const res = await fetch(`${BASE_URL}/api/driver/${id}/score`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`Individual score API error: ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[api/driver/[id]/score] Error:', err.message)
    return NextResponse.json({ ok: false, data: null }, { status: 500 })
  }
}
