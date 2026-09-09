import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await request.json()

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, credit_note_id, is_locked')
      .eq('id', Number(body.invoiceId))
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    if (invoice.credit_note_id) {
      return NextResponse.json({ error: 'Invoice already credited' }, { status: 409 })
    }
    if (invoice.is_locked) {
      return NextResponse.json({ error: 'Invoice is locked and cannot be credited' }, { status: 403 })
    }

    // Mark the original invoice as credited
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        credit_note_id: Number(body.creditNoteId),
        updated_at: new Date().toISOString(),
      })
      .eq('id', Number(body.invoiceId))

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
