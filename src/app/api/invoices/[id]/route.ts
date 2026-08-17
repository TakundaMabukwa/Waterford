import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if invoice is locked before allowing any changes
    const { data: existing, error: fetchError } = await supabase
      .from('invoices')
      .select('is_locked')
      .eq('id', Number(id))
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (existing.is_locked) {
      return NextResponse.json({ error: 'Invoice is locked and cannot be edited' }, { status: 403 })
    }

    const body = await request.json()

    const updateData: any = { updated_at: new Date().toISOString() }
    if (body.customerName !== undefined) updateData.customer_name = body.customerName
    if (body.customerAddress !== undefined) updateData.customer_address = body.customerAddress
    if (body.customerVat !== undefined) updateData.customer_vat = body.customerVat
    if (body.invoiceDate !== undefined) updateData.invoice_date = body.invoiceDate
    if (body.dueDate !== undefined) updateData.due_date = body.dueDate
    if (body.lineItems !== undefined) updateData.line_items = body.lineItems
    if (body.subtotal !== undefined) updateData.subtotal = body.subtotal
    if (body.vatAmount !== undefined) updateData.vat_amount = body.vatAmount
    if (body.totalAmount !== undefined) updateData.total_amount = body.totalAmount
    if (body.amountDue !== undefined) updateData.amount_due = body.amountDue
    if (body.currency !== undefined) updateData.currency = body.currency
    if (body.invoice_url !== undefined) updateData.invoice_url = body.invoice_url
    if (body.invoiceData !== undefined) updateData.invoice_data = body.invoiceData
    if (body.referenceNumber !== undefined) updateData.reference_number = body.referenceNumber
    if (body.salesCode !== undefined) updateData.sales_code = body.salesCode

    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', Number(id))
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
