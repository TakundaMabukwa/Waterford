import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase
      .from('trips')
      .select('id, trip_id, ordernumber, rate, status, origin, destination, cargo, selectedclient, clientdetails, vehicleassignments, loadcon_url, created_at, updated_at, actual_start_time, actual_end_time, approximate_fuel_cost, approximated_vehicle_cost, approximated_driver_cost, total_vehicle_cost, estimated_distance, fuel_used_liters, fuel_liters_per_km, fuel_cost_total, driver, vehicle, loading_point_company, loading_point_city, offloading_point_company, offloading_point_city, is_invoiced, invoice_url')
      .order('updated_at', { ascending: false })

    if (dateFrom) query = query.gte('updated_at', dateFrom + 'T00:00:00')
    if (dateTo) query = query.lte('updated_at', dateTo + 'T23:59:59')

    const { data: trips, error: tripsError } = await query
    if (tripsError) throw tripsError

    const tripIds = (trips || []).map((t: any) => t.trip_id).filter(Boolean)

    let auditMap: Record<string, any> = {}
    if (tripIds.length > 0) {
      const { data: auditData } = await supabase
        .from('audit')
        .select('trip_id, is_invoiced, invoice_url, actual_fuel_cost, actual_vehicle_cost, actual_driver_cost, actual_rate')
        .in('trip_id', tripIds)
      ;(auditData || []).forEach((a: any) => { auditMap[a.trip_id] = a })
    }

    const enriched = (trips || []).map((trip: any) => {
      const audit = auditMap[trip.trip_id] || {}
      return {
        ...trip,
        trip_row_id: trip.id,
        planned_rate: trip.rate || 0,
        planned_fuel_cost: trip.approximate_fuel_cost || 0,
        planned_vehicle_cost: trip.approximated_vehicle_cost || 0,
        planned_driver_cost: trip.approximated_driver_cost || 0,
        planned_total_cost: trip.total_vehicle_cost || 0,
        planned_distance: trip.estimated_distance || 0,
        actual_total_cost:
          Number(audit.actual_fuel_cost || 0) +
          Number(audit.actual_vehicle_cost || 0) +
          Number(audit.actual_driver_cost || 0),
        is_invoiced: audit.is_invoiced ?? trip.is_invoiced ?? false,
        invoice_url: audit.invoice_url || trip.invoice_url || null,
        fuel_used_liters: trip.fuel_used_liters ?? 0,
        fuel_liters_per_km: trip.fuel_liters_per_km ?? 0,
        fuel_cost_total: trip.fuel_cost_total ?? 0,
        client_name: trip.selectedclient || '',
        loading_point_company: trip.loading_point_company || '',
        loading_point_city: trip.loading_point_city || '',
        offloading_point_company: trip.offloading_point_company || '',
        offloading_point_city: trip.offloading_point_city || '',
      }
    })

    enriched.sort((a: any, b: any) => {
      const orderA = a.ordernumber || ''
      const orderB = b.ordernumber || ''
      return orderA.localeCompare(orderB, undefined, { numeric: true })
    })

    return NextResponse.json({ data: enriched })
  } catch (error: any) {
    console.error('Audit API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
