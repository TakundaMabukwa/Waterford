import { NextResponse } from 'next/server'

const normalizePlate = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const normalizeVehicle = (vehicle) => {
  const plate = vehicle?.plate || vehicle?.Plate || vehicle?.registration_number || ''
  return {
    ...vehicle,
    plate,
    registration_number: vehicle?.registration_number || plate,
    latitude: vehicle?.latitude || vehicle?.Latitude || null,
    longitude: vehicle?.longitude || vehicle?.Longitude || null,
    speed: vehicle?.speed || vehicle?.Speed || 0,
    mileage: vehicle?.mileage || vehicle?.Mileage || 0,
    geozone: vehicle?.geozone || vehicle?.Geozone || '',
    address: vehicle?.address || vehicle?.Geozone || 'GPS location available',
    loc_time: vehicle?.loc_time || vehicle?.LocTime || vehicle?.updated_at || null,
    driver_name: vehicle?.driver_name || vehicle?.DriverName || '',
    company: vehicle?.company || 'EPS',
    fuel_probe_1_level: vehicle?.fuel_probe_1_level ?? null,
    fuel_probe_1_volume_in_tank: vehicle?.fuel_probe_1_volume_in_tank ?? null,
    fuel_probe_1_temperature: vehicle?.fuel_probe_1_temperature ?? null,
    fuel_probe_1_level_percentage: vehicle?.fuel_probe_1_level_percentage ?? null,
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    const plate = searchParams.get('plate')
    const driver = searchParams.get('driver')

    const url = process.env.NEXT_PUBLIC_VEHICLE_API_ENDPOINT
    if (!url) {
      return NextResponse.json({ data: [], message: 'Vehicle endpoint is not configured' }, { status: 200 })
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      return NextResponse.json(
        { data: [], message: `Upstream vehicle API returned ${response.status}` },
        { status: 200 }
      )
    }
    
    const data = await response.json()
    const vehicleList = Array.isArray(data)
      ? data
      : (data?.result?.data || data?.data || [])
    const normalizedVehicles = vehicleList.map(normalizeVehicle)

    if (endpoint === 'by-plate' && plate) {
      const targetPlate = normalizePlate(plate)
      const matchedVehicle = normalizedVehicles.find((vehicle) =>
        normalizePlate(vehicle.plate || vehicle.registration_number) === targetPlate
      )

      if (!matchedVehicle) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
      }
      return NextResponse.json(matchedVehicle)
    }

    if (endpoint === 'by-driver' && driver) {
      const targetDriver = String(driver).trim().toLowerCase()
      const matchedVehicle = normalizedVehicles.find((vehicle) =>
        String(vehicle.driver_name || '').trim().toLowerCase() === targetDriver
      )

      if (!matchedVehicle) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
      }
      return NextResponse.json(matchedVehicle)
    }

    return NextResponse.json({ data: normalizedVehicles })
    
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    
    return NextResponse.json(
      { 
        message: 'Failed to fetch vehicles',
        data: [],
        error: error?.message || 'Unknown error',
      },
      { status: 200 }
    )
  }
}
