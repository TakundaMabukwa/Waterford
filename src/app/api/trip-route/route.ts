/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ROUTING_SERVER_BASE_URL =
  process.env.NEXT_PUBLIC_CAN_BUS_ENDPOINT || 'http://64.227.126.176:3001'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

const parsePointTime = (value: unknown) => {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get('tripId')

    if (!tripId) {
      return NextResponse.json({ error: 'Trip ID required' }, { status: 400 })
    }

    // Fetch trip record to get both id (PK) and trip_id (string identifier).
    // The routing server historically expected one or the other; resolve to whichever is present.
    let resolvedTripId: string = tripId
    let resolvedTripPk: string | null = null
    if (supabase) {
      const { data: trip } = await supabase
        .from('trips')
        .select('id, trip_id')
        .or(`id.eq.${Number.isFinite(Number(tripId)) ? tripId : -1},trip_id.eq.${tripId}`)
        .maybeSingle()
      if (trip) {
        resolvedTripPk = String(trip.id)
        resolvedTripId = trip.trip_id || String(trip.id)
      }
    }

    // Try the string trip_id first, then the numeric id as a fallback
    const candidates = resolvedTripPk && resolvedTripPk !== resolvedTripId
      ? [resolvedTripId, resolvedTripPk]
      : [resolvedTripId]

    let data: any = null
    let lastError: string | null = null
    let lastStatus = 0
    for (const candidate of candidates) {
      const response = await fetch(
        `${ROUTING_SERVER_BASE_URL}/api/trips/${candidate}/route?company=waterford`,
        { cache: 'no-store' }
      )
      if (response.ok) {
        data = await response.json()
        lastStatus = 200
        break
      }
      lastStatus = response.status
      lastError = await response.text()
    }

    if (!data) {
      console.error('Routing server error (all candidates failed):', lastError)
      // Graceful fallback: return empty route so the audit page still renders.
      // Use 200 with a flag so the client can render without crashing.
      return NextResponse.json(
        { route_points: [], _unavailable: true, _status: lastStatus },
        { status: 200 }
      )
    }

    const routePoints = Array.isArray(data?.route_points) ? data.route_points : []

    if (!supabase || !routePoints.length) {
      return NextResponse.json({ ...data, route_points: routePoints })
    }

    const { data: trip, error } = await supabase
      .from('trips')
      .select('id, status, accepted_at, actual_end_time')
      .eq('id', Number(resolvedTripPk ?? tripId))
      .single()

    if (error || !trip?.accepted_at) {
      return NextResponse.json({ ...data, route_points: routePoints })
    }

    const startAt = parsePointTime(trip.accepted_at)
    const status = String(trip.status || '').toLowerCase()
    const finished = status === 'completed' || status === 'delivered'
    const endAt = parsePointTime(finished ? trip.actual_end_time : new Date().toISOString())

    if (!startAt || !endAt) {
      return NextResponse.json({ ...data, route_points: routePoints })
    }

    const filteredRoutePoints = routePoints.filter((point: any) => {
      const pointTime = parsePointTime(point?.datetime || point?.timestamp || point?.LocTime)
      if (!pointTime) return false
      return pointTime >= startAt && pointTime <= endAt
    })

    return NextResponse.json({
      ...data,
      route_points: filteredRoutePoints,
      trip_window: {
        start_at: trip.accepted_at,
        end_at: finished ? trip.actual_end_time : new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error fetching trip route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
