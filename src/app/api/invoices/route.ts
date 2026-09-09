import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const draft = searchParams.get('draft')
    const finalized = searchParams.get('finalized')
    const month = searchParams.get('month')
    const tripId = searchParams.get('trip_id')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase.from('invoices').select('*')

    if (draft === 'true') query = query.eq('is_draft', true)
    if (finalized === 'true') query = query.eq('is_draft', false)
    if (month) query = query.eq('lock_month', month)
    if (tripId) query = query.eq('trip_id', tripId)

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error

    // Fetch ordernumbers from trips for invoices with trip_id
    const tripIds = (data || []).filter((inv: any) => inv.trip_id).map((inv: any) => inv.trip_id)
    let tripOrderMap: Record<string, string> = {}
    if (tripIds.length > 0) {
      const { data: tripsData } = await supabase
        .from('trips')
        .select('trip_id, ordernumber')
        .in('trip_id', tripIds)
      ;(tripsData || []).forEach((t: any) => {
        tripOrderMap[t.trip_id] = t.ordernumber
      })
    }

    // Enrich invoices with ordernumber
    const enriched = (data || []).map((inv: any) => ({
      ...inv,
      ordernumber: inv.trip_id ? tripOrderMap[inv.trip_id] || null : null,
    }))

    // Enrich with invoice_email_groups from client list
    const customerNames = [...new Set(enriched.filter((inv: any) => inv.customer_name).map((inv: any) => inv.customer_name))]
    let clientEmailMap: Record<string, any[]> = {}
    if (customerNames.length > 0) {
      const { data: clients } = await supabase.from('eps_client_list').select('name, client_id, invoice_email_groups')
      const normalize = (s: string) => (s || '').replace(/^\(\$\)\s*/, '').replace(/^\$\s*/, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
      for (const name of customerNames) {
        const targetNorm = normalize(name)
        const matched = (clients || []).find((c: any) => normalize(c.name) === targetNorm || normalize(c.client_id) === targetNorm)
        if (matched?.invoice_email_groups?.length) {
          clientEmailMap[name] = matched.invoice_email_groups
        }
      }
    }

    const enrichedWithGroups = enriched.map((inv: any) => ({
      ...inv,
      invoice_email_groups: inv.invoice_email_groups || clientEmailMap[inv.customer_name] || [],
    }))

    // Attach document counts — sundry invoices keyed by sundry_invoice_id, trips by trip_id
    const tripInvoiceIds = enrichedWithGroups.filter((inv: any) => inv.trip_id).map((inv: any) => inv.trip_id)
    const sundryInvoiceIds = enrichedWithGroups.filter((inv: any) => !inv.trip_id).map((inv: any) => inv.id)
    let docCountMap: Record<string, number> = {}
    if (tripInvoiceIds.length > 0) {
      const { data: tripDocs } = await supabase
        .from('invoice_documents')
        .select('trip_id, documents')
        .in('trip_id', tripInvoiceIds)
      ;(tripDocs || []).forEach((d: any) => {
        docCountMap[`trip:${d.trip_id}`] = d.documents?.length || 0
      })
    }
    if (sundryInvoiceIds.length > 0) {
      const { data: sundryDocs } = await supabase
        .from('invoice_documents')
        .select('sundry_invoice_id, documents')
        .in('sundry_invoice_id', sundryInvoiceIds)
      ;(sundryDocs || []).forEach((d: any) => {
        docCountMap[`sundry:${d.sundry_invoice_id}`] = d.documents?.length || 0
      })
    }

    const withDocCounts = enrichedWithGroups.map((inv: any) => ({
      ...inv,
      document_count: inv.trip_id ? docCountMap[`trip:${inv.trip_id}`] || 0 : docCountMap[`sundry:${inv.id}`] || 0,
    }))

    return NextResponse.json({ data: withDocCounts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await request.json()

    // Resolve user for created_by
    let createdBy = 'unknown'
    try {
      const serverClient = await createServerClient()
      if (serverClient) {
        const { data: { user } } = await serverClient.auth.getUser()
        if (user) createdBy = user.email || user.id || 'unknown'
      }
    } catch {}

    // Generate invoice or credit note number
    const rpcName = body.isCreditNote ? 'get_next_credit_note_number' : 'get_next_invoice_number'
    const { data: invoiceNumber, error: numError } = await supabase
      .rpc(rpcName)

    if (numError || !invoiceNumber) {
      return NextResponse.json({ error: 'Failed to generate number' }, { status: 500 })
    }

    const insertData: any = {
      invoice_number: invoiceNumber,
      trip_id: body.tripId || null,
      sundry_invoice_id: body.sundryInvoiceId || null,
      is_draft: true,
      is_credit_note: body.isCreditNote || false,
      customer_name: body.customerName || '',
      customer_address: body.customerAddress || '',
      customer_vat: body.customerVat || '',
      invoice_date: body.invoiceDate || '',
      due_date: body.dueDate || '',
      line_items: body.lineItems || [],
      subtotal: body.subtotal || 0,
      vat_amount: body.vatAmount || 0,
      total_amount: body.totalAmount || 0,
      amount_due: body.amountDue || 0,
      currency: body.currency || 'ZAR',
      invoice_data: body.invoiceData || null,
      reference_number: body.referenceNumber || null,
      sales_code: body.salesCode || null,
      created_by: createdBy,
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert([insertData])
      .select()
      .single()

    if (error) throw error

    // Log creation in audit trail
    await supabase.from('invoice_audit_log').insert({
      invoice_id: data.id,
      action: 'created',
      field_changed: null,
      old_value: null,
      new_value: `Draft ${invoiceNumber} created`,
      changed_by: createdBy,
    })

    // Trip is marked as invoiced only when the draft is finalized, not at draft creation.
    // See: POST /api/invoices/[id]/finalize

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
