import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0')
    const limit = parseInt(searchParams.get('limit') || '100')
    const from = page * limit
    const to = from + limit - 1

    const { data, error } = await supabase
      .from('trips')
      .select('id, ordernumber, clientdetails')
      .not('ordernumber', 'is', null)
      .not('ordernumber', 'eq', '')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    console.error('Error fetching order numbers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
