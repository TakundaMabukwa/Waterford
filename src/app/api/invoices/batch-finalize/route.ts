import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No invoice IDs provided' }, { status: 400 })
    }

    const results: { id: number; invoice_number: string | null; success: boolean; error?: string }[] = []

    for (const id of ids) {
      try {
        // Fetch the draft invoice
        const { data: draft, error: fetchError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', Number(id))
          .single()

        if (fetchError || !draft) {
          results.push({ id: Number(id), invoice_number: null, success: false, error: 'Not found' })
          continue
        }

        if (!draft.is_draft) {
          results.push({ id: Number(id), invoice_number: draft.invoice_number, success: false, error: 'Already finalized' })
          continue
        }

        if (draft.is_locked) {
          results.push({ id: Number(id), invoice_number: null, success: false, error: 'Invoice is locked' })
          continue
        }

        const invoiceNumber = draft.invoice_number
        if (!invoiceNumber) {
          results.push({ id: Number(id), invoice_number: null, success: false, error: 'Invoice number not assigned' })
          continue
        }

        const lockMonth = draft.invoice_date ? draft.invoice_date.substring(0, 7) : null

        // Mark as finalized
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            is_draft: false,
            lock_month: lockMonth,
            updated_at: new Date().toISOString(),
          })
          .eq('id', Number(id))

        if (updateError) throw updateError

        // Update trip record if applicable
        if (draft.trip_id) {
          await supabase
            .from('trips')
            .update({
              invoice_number: invoiceNumber,
              is_invoiced: true,
            })
            .eq('trip_id', draft.trip_id)
        }

        results.push({ id: Number(id), invoice_number: invoiceNumber, success: true })
      } catch (err: any) {
        results.push({ id: Number(id), invoice_number: null, success: false, error: err.message })
      }
    }

    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
