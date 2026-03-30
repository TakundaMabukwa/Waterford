/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ROUTING_SERVER_BASE_URL =
  process.env.NEXT_PUBLIC_CAN_BUS_ENDPOINT || 'http://64.227.126.176:3001'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

    const response = await fetch(
      `${ROUTING_SERVER_BASE_URL}/api/trips/${tripId}/route?company=waterford`,
      { cache: 'no-store' }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Routing server error:', error)
      return NextResponse.json({ error: 'Failed to fetch route from server' }, { status: response.status })
    }

    const data = await response.json()
    const routePoints = Array.isArray(data?.route_points) ? data.route_points : []

    if (!supabase || !routePoints.length) {
      return NextResponse.json({ ...data, route_points: routePoints })
    }

    const { data: trip, error } = await supabase
      .from('trips')
      .select('id, status, accepted_at, actual_end_time')
      .eq('id', Number(tripId))
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
