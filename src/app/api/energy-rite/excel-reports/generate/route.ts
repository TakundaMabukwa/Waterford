import { NextRequest, NextResponse } from 'next/server';
import { buildEnergyRiteReportsUrl } from '@/lib/server/energy-rite-upstream';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const externalApiUrl = buildEnergyRiteReportsUrl('/api/energy-rite/excel-reports/generate');

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: payload?.error || payload?.message || `Failed to generate report: ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Excel reports proxy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while generating Excel report',
      },
      { status: 500 }
    );
  }
}
