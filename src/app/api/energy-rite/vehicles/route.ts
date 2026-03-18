import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DEFAULT_VEHICLES_ENDPOINT = 'http://209.38.217.58:8000/api/waterford-sites';

export async function GET(request: NextRequest) {
  try {
    const upstreamBase =
      process.env.NEXT_PUBLIC_VEHICLE_API_ENDPOINT ||
      process.env.VEHICLE_API_ENDPOINT ||
      DEFAULT_VEHICLES_ENDPOINT;

    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const upstreamUrl = query ? `${upstreamBase}?${query}` : upstreamBase;

    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Allow clients to handle either array or object payloads.
    if (Array.isArray(data)) {
      return NextResponse.json(data, { status: 200 });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch vehicles' },
      { status: 500 }
    );
  }
}
