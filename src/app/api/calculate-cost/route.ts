import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateTripCost, VehicleCostData } from '@/lib/cost-engine'

export async function POST(request: NextRequest) {
  try {
    const { vehicleId, distanceKm, tripDays, fuelPrice } = await request.json()
    console.log('[calculate-cost] Request:', { vehicleId, distanceKm, tripDays, fuelPrice })

    if (!vehicleId || !distanceKm || distanceKm <= 0) {
      return NextResponse.json({ error: 'vehicleId and distanceKm are required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehiclesc')
      .select(`
        monthly_depreciation,
        monthly_insurance,
        monthly_licence,
        monthly_interest,
        monthly_repairs,
        repairs_per_km,
        breakdowns_per_km,
        tolls_per_km,
        driver_ot_per_km,
        cross_border_charge
      `)
      .eq('id', vehicleId)
      .single()

    console.log('[calculate-cost] Vehicle lookup:', { vehicle, vehicleError })

    if (vehicleError || !vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const fuelLinkRate = fuelPrice || 21

    const result = calculateTripCost({
      vehicleCosts: vehicle as VehicleCostData,
      distanceKm,
      tripDays: tripDays || 1,
      fuelLinkRate,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('Error calculating cost:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
