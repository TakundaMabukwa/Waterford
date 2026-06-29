import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch('http://138.197.183.168:4000/api/vehicles', {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const json = await response.json()
    const vehicles = json.vehicles || json

    const processedData = vehicles.map((v) => {
      const p1Vol = v.fuel_probe_1_volume_in_tank || 0
      const p2Vol = v.fuel_probe_2_volume_in_tank || 0
      const p1Pct = v.fuel_probe_1_level_percentage || 0
      const p2Pct = v.fuel_probe_2_level_percentage || 0
      const hasP2 = p2Pct > 0 || p2Vol > 0

      return {
        plate: v.plate,
        timestamp: v.updated_at || v.loc_time || '',
        fuelLevel: p1Vol,
        fuelPercentage: p1Pct,
        totalFuelUsed: p1Vol,
        engineTemperature: v.fuel_probe_1_temperature || 0,
        fuelProbe2Level: v.fuel_probe_2_level || 0,
        fuelProbe2Percentage: p2Pct,
        fuelProbe2VolumeInTank: p2Vol,
        fuelProbe2Temperature: v.fuel_probe_2_temperature || 0,
        combinedFuelVolume: hasP2 ? p1Vol + p2Vol : p1Vol,
        combinedFuelPercentage: hasP2 ? Math.round((p1Pct + p2Pct) / 2) : p1Pct,
        speed: v.speed || 0,
        latitude: v.latitude,
        longitude: v.longitude,
        mileage: v.mileage || '',
        driverName: v.driver_name || '',
        geozone: v.geozone || '',
        engineStatus: v.status || '',
      }
    })

    return NextResponse.json(processedData)
  } catch (error) {
    console.error('Fuel proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch fuel data' }, { status: 500 })
  }
}
