import { NextRequest, NextResponse } from 'next/server';
import { buildEnergyRiteReportsUrl } from '@/lib/server/energy-rite-upstream';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';
    const costCode = searchParams.get('cost_code');
    const costCodes = searchParams.get('cost_codes');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    console.log('🚀 Enhanced Executive Dashboard Request:', { period, costCode, costCodes });

    // Build parameters for external API call
    const params = new URLSearchParams();
    if (startDate && endDate) {
      params.append('start_date', startDate);
      params.append('end_date', endDate);
    } else {
      params.append('period', period);
    }
    
    if (costCode) {
      params.append('costCode', costCode);
    }
    if (costCodes) {
      params.append('costCodes', costCodes);
    }

    // Forward the request to the external API
    const externalApiUrl = buildEnergyRiteReportsUrl('/api/energy-rite/enhanced-executive-dashboard');
    const apiUrl = `${externalApiUrl}?${params.toString()}`;

    console.log('🔄 Forwarding to enhanced executive API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Enhanced executive API error:', response.status, response.statusText);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch enhanced executive dashboard: ${response.statusText}`
      }, { status: response.status });
    }

    const data = await response.json();
    
    console.log('✅ Enhanced executive dashboard data received successfully');

    // Return the data in the expected format
    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ Enhanced executive dashboard error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error while fetching enhanced executive dashboard'
    }, { status: 500 });
  }
}
