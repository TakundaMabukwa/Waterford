import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch('http://138.197.183.168:4000/api/vehicles', {
      cache: 'no-store',
    })

    if (!response.ok) throw new Error('Failed to fetch fuel data')

    const json = await response.json()
    const vehicles = json.vehicles || json

    const processedData = vehicles.map((v: any) => ({
      plate: v.plate,
      timestamp: v.updated_at || v.loc_time || '',
      fuelLevel: v.fuel_probe_1_level || 0,
      fuelPercentage: v.fuel_probe_1_level_percentage || 0,
      engineTemperature: v.fuel_probe_1_temperature || 0,
      totalFuelUsed: v.fuel_probe_1_volume_in_tank || 0,
    }))

    return NextResponse.json({ data: processedData })
  } catch (error) {
    console.error('Error fetching fuel data:', error)
    return NextResponse.json({ error: 'Failed to fetch fuel data' }, { status: 500 })
  }
}
