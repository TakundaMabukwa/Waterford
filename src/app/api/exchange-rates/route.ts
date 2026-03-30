import { NextRequest, NextResponse } from 'next/server'

const API_BASE = 'https://api.frankfurter.app/latest'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const base = String(searchParams.get('base') || 'ZAR').toUpperCase()
  const target = String(searchParams.get('target') || 'USD').toUpperCase()

  if (!base || !target) {
    return NextResponse.json({ error: 'base and target are required' }, { status: 400 })
  }

  if (base === target) {
    return NextResponse.json({
      base,
      target,
      rate: 1,
      date: new Date().toISOString().slice(0, 10),
      source: 'identity',
    })
  }

  try {
    const response = await fetch(`${API_BASE}?from=${base}&to=${target}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json({ error: text || 'Failed to fetch exchange rate' }, { status: 502 })
    }

    const data = await response.json()
    const rate = Number(data?.rates?.[target])

    if (!Number.isFinite(rate)) {
      return NextResponse.json({ error: 'Exchange rate not available' }, { status: 502 })
    }

    return NextResponse.json({
      base,
      target,
      rate,
      date: data?.date || null,
      source: 'frankfurter',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch exchange rate' },
      { status: 500 }
    )
  }
}
