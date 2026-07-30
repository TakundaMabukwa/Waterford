import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('sundry_invoices')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const invoiceNumber = body.invoiceNumber
    if (!invoiceNumber) {
      return NextResponse.json({ error: 'invoiceNumber is required' }, { status: 400 })
    }

    const insertData = {
      invoice_number: invoiceNumber,
      customer_name: body.customerName || '',
      customer_address: body.customerAddress || '',
      customer_vat: body.customerVat || '',
      invoice_date: body.invoiceDate || '',
      due_date: body.dueDate || '',
      reference_number: body.referenceNumber || '',
      line_items: body.lineItems || [],
      subtotal: body.subtotal || 0,
      vat_amount: body.vatAmount || 0,
      total_amount: body.totalAmount || 0,
      less_amount_paid: body.lessAmountPaid || 0,
      less_amount_credited: body.lessAmountCredited || 0,
      amount_due: body.amountDue || 0,
      invoice_url: body.invoiceUrl || null,
      currency: body.currency || 'ZAR',
    }

    const { data, error } = await supabase
      .from('sundry_invoices')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, invoiceNumber })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
