import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

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

    // Resolve user for audit trail
    let finalizedBy = 'unknown'
    try {
      const serverClient = await createServerClient()
      if (serverClient) {
        const { data: { user } } = await serverClient.auth.getUser()
        if (user) finalizedBy = user.email || user.id || 'unknown'
      }
    } catch {}

    if (!draft.is_draft) {
      return NextResponse.json({ error: 'Already finalized' }, { status: 400 })
    }

    if (draft.is_locked) {
      return NextResponse.json({ error: 'Invoice is locked' }, { status: 400 })
    }

    // Invoice number already assigned at draft creation
    const invoiceNumber = draft.invoice_number
    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invoice number not assigned' }, { status: 500 })
    }

    const lockMonth = draft.invoice_date ? draft.invoice_date.substring(0, 7) : null

    // Update the invoice — mark as finalized (number already exists)
    const { data, error } = await supabase
      .from('invoices')
      .update({
        is_draft: false,
        lock_month: lockMonth,
        updated_at: new Date().toISOString(),
      })
      .eq('id', Number(id))
      .select()
      .single()

    if (error) throw error

    // Log finalization in audit trail
    await supabase.from('invoice_audit_log').insert({
      invoice_id: Number(id),
      action: 'finalized',
      field_changed: null,
      old_value: 'Draft',
      new_value: `Finalized as ${invoiceNumber}`,
      changed_by: finalizedBy,
    })

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
