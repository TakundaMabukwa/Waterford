import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_next_invoice_number');
    if (error) {
      console.error('Supabase RPC error:', error);
      return NextResponse.json({ error: 'Failed to get next invoice number' }, { status: 500 });
    }
    return NextResponse.json({ invoiceNumber: data });
  } catch (err) {
    console.error('Next invoice number error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
