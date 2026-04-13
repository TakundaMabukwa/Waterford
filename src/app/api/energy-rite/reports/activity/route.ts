import { NextRequest, NextResponse } from 'next/server';
import { buildEnergyRiteReportsUrl } from '@/lib/server/energy-rite-upstream';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date') || searchParams.get('startDate');
    const endDate = searchParams.get('end_date') || searchParams.get('endDate');
    const costCode = searchParams.get('cost_code') || searchParams.get('costCode');
    const siteId = searchParams.get('site_id');

    console.log('Activity Report Request:', { date, startDate, endDate, costCode, siteId });

    const today = new Date().toISOString().split('T')[0];
    const effectiveStartDate = startDate || date || today;
    const effectiveEndDate = endDate || date || effectiveStartDate;

    const params = new URLSearchParams();

    if (startDate || endDate) {
      params.append('start_date', effectiveStartDate);
      params.append('end_date', effectiveEndDate);
    } else {
      params.append('date', effectiveStartDate);
    }

    if (siteId) {
      params.append('site_id', siteId);
    }

    if (costCode) {
      params.append('cost_code', costCode);
    }

    const externalApiUrl = buildEnergyRiteReportsUrl('/api/energy-rite/activity-reports');
    const apiUrl = `${externalApiUrl}?${params.toString()}`;

    console.log('Forwarding to external API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('External API error:', response.status, response.statusText);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch activity reports: ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const upstream = await response.json();
    const data = upstream?.success && upstream?.data ? upstream.data : upstream;

    console.log('Activity reports data received successfully');

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Activity reports error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while fetching activity reports',
      },
      { status: 500 }
    );
  }
}
