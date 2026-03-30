import { NextRequest, NextResponse } from 'next/server';
import { buildEnergyRiteReportsUrl } from '@/lib/server/energy-rite-upstream';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const costCode = searchParams.get('cost_code') || searchParams.get('costCode');
    const siteId = searchParams.get('site_id');

    console.log('📊 Activity Report Request:', { date, costCode, siteId });

    // Set default date to today if not provided
    const reportDate = date || new Date().toISOString().split('T')[0];

    // Build parameters for external API call
    const params = new URLSearchParams();
    params.append('date', reportDate);
    
    if (siteId) {
      params.append('site_id', siteId);
    }
    if (costCode) {
      params.append('cost_code', costCode);
    }

    // Forward the request to the external API
    const externalApiUrl = buildEnergyRiteReportsUrl('/api/energy-rite/activity-reports');
    const apiUrl = `${externalApiUrl}?${params.toString()}`;

    console.log('🔄 Forwarding to external API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ External API error:', response.status, response.statusText);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch activity reports: ${response.statusText}`
      }, { status: response.status });
    }

    const upstream = await response.json();
    const data = upstream?.success && upstream?.data ? upstream.data : upstream;
    
    console.log('✅ Activity reports data received successfully');

    // Return the data in the expected format
    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ Activity reports error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error while fetching activity reports'
    }, { status: 500 });
  }
}
