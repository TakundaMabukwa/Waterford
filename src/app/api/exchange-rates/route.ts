import { NextRequest, NextResponse } from 'next/server'

const API_BASE = 'https://api.getgeoapi.com/v2/currency/convert'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const base = String(searchParams.get('base') || 'ZAR').toUpperCase()
  const target = String(searchParams.get('target') || 'USD').toUpperCase()
  const apiKey = process.env.CURRENCY_CONVERTER_API_KEY

  if (!base || !target) {
    return NextResponse.json({ error: 'base and target are required' }, { status: 400 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'CURRENCY_CONVERTER_API_KEY is not configured' }, { status: 500 })
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
    const params = new URLSearchParams({
      api_key: apiKey,
      from: base,
      to: target,
      amount: '1',
      format: 'json',
    })

    const response = await fetch(`${API_BASE}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json({ error: text || 'Failed to fetch exchange rate' }, { status: response.status })
    }

    const data = await response.json()

    if (data?.status !== 'success') {
      return NextResponse.json(
        { error: data?.error?.message || 'Currency conversion failed' },
        { status: Number(data?.error?.code) || 502 }
      )
    }

    const targetRate = data?.rates?.[target]
    const rate = Number(targetRate?.rate)

    if (!Number.isFinite(rate)) {
      return NextResponse.json({ error: 'Exchange rate not available' }, { status: 502 })
    }

    return NextResponse.json({
      base,
      target,
      rate,
      date: data?.updated_date || null,
      source: 'getgeoapi',
      amount: Number(data?.amount || 1),
      rate_for_amount: Number(targetRate?.rate_for_amount || rate),
      currency_name: targetRate?.currency_name || target,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch exchange rate' },
      { status: 500 }
    )
  }
}
