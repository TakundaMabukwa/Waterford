import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const NEW_API_URL = 'http://138.197.183.168:4000/api/vehicles'

function getSupabaseClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Supabase URL not configured')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// *****************************
// GET vehicle by plate (from external API)
// *****************************
export async function GET(request, { params }) {
  const { id: plate } = await params

  try {
    const response = await fetch(`${NEW_API_URL}/${encodeURIComponent(plate)}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      )
    }

    const v = await response.json()

    return NextResponse.json({
      plate: v.plate,
      cost_code: v.cost_code || '',
      speed: v.speed || 0,
      latitude: v.latitude,
      longitude: v.longitude,
      mileage: v.mileage || '',
      status: v.status || '',
      driver_name: v.driver_name || '',
      geozone: v.geozone || '',
      fuel_probe_1_level: v.fuel_probe_1_level || 0,
      fuel_probe_1_volume_in_tank: v.fuel_probe_1_volume_in_tank || 0,
      fuel_probe_1_temperature: v.fuel_probe_1_temperature || 0,
      fuel_probe_1_level_percentage: v.fuel_probe_1_level_percentage || 0,
      fuel_probe_2_level: v.fuel_probe_2_level || 0,
      fuel_probe_2_volume_in_tank: v.fuel_probe_2_volume_in_tank || 0,
      fuel_probe_2_temperature: v.fuel_probe_2_temperature || 0,
      fuel_probe_2_level_percentage: v.fuel_probe_2_level_percentage || 0,
      updated_at: v.updated_at || v.loc_time || '',
      loc_time: v.loc_time || '',
    })
  } catch (error) {
    console.error('Vehicle proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch vehicle' }, { status: 500 })
  }
}

// *****************************
// update vehicle
// *****************************
export async function PUT(request, { params }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing vehicle ID' }, { status: 400 })

  const body = await request.json()
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('vehiclesc')
      .update(body)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to update vehicle with id: ${id}` },
      { status: 500 }
    )
  }
}

// *****************************
// delete vehicle
// *****************************
export async function DELETE(request, { params }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing vehicle ID' }, { status: 400 })

  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('vehiclesc')
      .delete()
      .eq('id', id)
    if (error) throw error

    return NextResponse.json(id, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Something went wrong...' },
      { status: 500 }
    )
  }
}
