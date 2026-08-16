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
    const body = await request.json()

    const updateData: any = {
      customer_name: body.customerName,
      customer_address: body.customerAddress,
      customer_vat: body.customerVat,
      invoice_date: body.invoiceDate,
      line_items: body.lineItems,
      subtotal: body.subtotal,
      vat_amount: body.vatAmount,
      total_amount: body.totalAmount,
      amount_due: body.amountDue,
      currency: body.currency,
      invoice_data: body.invoiceData,
      reference_number: body.referenceNumber,
      sales_code: body.salesCode,
      updated_at: new Date().toISOString(),
    }

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
