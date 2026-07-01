import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('audit')
      .update({ is_invoiced: true })
      .eq('id', Number(id))
      .select()
      .single();

    if (error) {
      console.error('Failed to mark audit invoiced:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, audit: data });
  } catch (err) {
    console.error('Mark invoiced error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
