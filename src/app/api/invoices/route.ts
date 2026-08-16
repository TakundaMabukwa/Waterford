import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    return NextResponse.json({ data: enriched })
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

    const insertData: any = {
      trip_id: body.tripId || null,
      sundry_invoice_id: body.sundryInvoiceId || null,
      is_draft: true,
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
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert([insertData])
      .select()
      .single()

    if (error) throw error

    // Mark trip as invoiced if it's a trip invoice
    if (body.tripId) {
      await supabase
        .from('trips')
        .update({ is_invoiced: true })
        .eq('trip_id', body.tripId)
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
