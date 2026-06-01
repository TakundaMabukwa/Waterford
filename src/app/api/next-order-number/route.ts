import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_next_order_number');

    if (error) {
      console.error('Supabase RPC error:', error);
      return NextResponse.json({ error: 'Failed to get next order number' }, { status: 500 });
    }

    return NextResponse.json({ orderNumber: data });
  } catch (err) {
    console.error('Next order number error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
