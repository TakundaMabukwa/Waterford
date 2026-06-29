import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const NEW_API_URL = 'http://138.197.183.168:4000/api/vehicles';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(NEW_API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const json = await response.json();
    const rawVehicles = json.vehicles || json;

    const vehicles = rawVehicles.map((v) => ({
      id: v.plate,
      Plate: v.plate,
      plate: v.plate,
      branch: v.plate,
      company: v.cost_code || '',
      cost_code: v.cost_code || '',
      Speed: v.speed || 0,
      speed: v.speed || 0,
      Latitude: v.latitude,
      longitude: v.longitude,
      Geozone: v.geozone || '',
      address: v.geozone || '',
      DriverName: v.driver_name || '',
      drivername: v.driver_name || '',
      fuel_probe_1_level: v.fuel_probe_1_level || 0,
      fuel_probe_1_volume_in_tank: v.fuel_probe_1_volume_in_tank || 0,
      fuel_probe_1_temperature: v.fuel_probe_1_temperature || 0,
      fuel_probe_1_level_percentage: v.fuel_probe_1_level_percentage || 0,
      fuel_probe_2_level: v.fuel_probe_2_level || 0,
      fuel_probe_2_volume_in_tank: v.fuel_probe_2_volume_in_tank || 0,
      fuel_probe_2_temperature: v.fuel_probe_2_temperature || 0,
      fuel_probe_2_level_percentage: v.fuel_probe_2_level_percentage || 0,
      volume: v.fuel_probe_1_volume_in_tank || 0,
      last_message_date: v.loc_time || v.updated_at || new Date().toISOString(),
      updated_at: v.updated_at || new Date().toISOString(),
      mileage: v.mileage || '',
      status: v.status || '',
      item_installed: v.item_installed || '',
    }));

    return NextResponse.json(vehicles, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vehicles' },
      { status: 500 }
    );
  }
}
