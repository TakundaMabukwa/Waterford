import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch the draft invoice
    const { data: draft, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', Number(id))
      .single()

    if (fetchError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    if (!draft.is_draft) {
      return NextResponse.json({ error: 'Already finalized' }, { status: 400 })
    }

    if (draft.is_locked) {
      return NextResponse.json({ error: 'Invoice is locked' }, { status: 400 })
    }

    // Get next invoice number - RPC returns full format like "INV20051"
    const { data: invoiceNumber, error: numError } = await supabase
      .rpc('get_next_invoice_number')

    if (numError || !invoiceNumber) {
      return NextResponse.json({ error: 'Failed to get invoice number' }, { status: 500 })
    }

    const lockMonth = draft.invoice_date ? draft.invoice_date.substring(0, 7) : null

    // Update the invoice with the number and mark as finalized
    const { data, error } = await supabase
      .from('invoices')
      .update({
        invoice_number: invoiceNumber,
        is_draft: false,
        lock_month: lockMonth,
        updated_at: new Date().toISOString(),
      })
      .eq('id', Number(id))
      .select()
      .single()

    if (error) throw error

    // Also update the trip record if it's a trip invoice
    if (draft.trip_id) {
      await supabase
        .from('trips')
        .update({
          invoice_number: invoiceNumber,
          is_invoiced: true,
        })
        .eq('trip_id', draft.trip_id)
    }

    return NextResponse.json({ data, invoiceNumber })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
