import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

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

    // Get the authenticated user from the session (server-side, not from body)
    let changedBy = 'unknown'
    try {
      const serverClient = await createServerClient()
      if (serverClient) {
        const { data: { user } } = await serverClient.auth.getUser()
        if (user) {
          changedBy = user.email || user.id || 'unknown'
        }
      }
    } catch {
      // Fall back to 'unknown' if session can't be resolved
    }

    // Fetch current invoice (allow editing of non-locked invoices, including finalized ones)
    const { data: existing, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', Number(id))
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (existing.is_locked) {
      // Allow setting credit_note_id even on locked invoices
      const body = await request.json()
      if (body.creditNoteId) {
        const { error } = await supabase
          .from('invoices')
          .update({ credit_note_id: body.creditNoteId })
          .eq('id', Number(id))
        if (error) throw error
        // Log credit note assignment
        await supabase.from('invoice_audit_log').insert({
          invoice_id: Number(id),
          action: 'credited',
          field_changed: 'credit_note_id',
          old_value: null,
          new_value: String(body.creditNoteId),
          changed_by: changedBy,
        })
        return NextResponse.json({ data: { id: Number(id), credit_note_id: body.creditNoteId } })
      }
      return NextResponse.json({ error: 'Invoice is locked and cannot be edited' }, { status: 403 })
    }

    const body = await request.json()

    // Track changes for audit trail
    const changes: { field: string; oldValue: any; newValue: any }[] = []

    const fieldMap: Record<string, string> = {
      customerName: 'customer_name',
      customerAddress: 'customer_address',
      customerVat: 'customer_vat',
      invoiceDate: 'invoice_date',
      dueDate: 'due_date',
      lineItems: 'line_items',
      subtotal: 'subtotal',
      vatAmount: 'vat_amount',
      totalAmount: 'total_amount',
      amountDue: 'amount_due',
      currency: 'currency',
      invoice_url: 'invoice_url',
      invoiceNumber: 'invoice_number',
      referenceNumber: 'reference_number',
      salesCode: 'sales_code',
      creditNoteId: 'credit_note_id',
    }

    const updateData: any = { updated_at: new Date().toISOString() }

    for (const [camelKey, dbKey] of Object.entries(fieldMap)) {
      if (body[camelKey] !== undefined) {
        const oldVal = existing[dbKey]
        const newVal = body[camelKey]
        const oldStr = JSON.stringify(oldVal)
        const newStr = JSON.stringify(newVal)
        if (oldStr !== newStr) {
          changes.push({ field: dbKey, oldValue: oldVal, newValue: newVal })
        }
        updateData[dbKey] = newVal
      }
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', Number(id))
      .select()
      .single()

    if (error) throw error

    // Log audit trail entries using server-derived user identity
    if (changes.length > 0) {
      const auditEntries = changes.map((c) => ({
        invoice_id: Number(id),
        action: 'updated',
        field_changed: c.field,
        old_value: typeof c.oldValue === 'object' ? JSON.stringify(c.oldValue) : String(c.oldValue ?? ''),
        new_value: typeof c.newValue === 'object' ? JSON.stringify(c.newValue) : String(c.newValue ?? ''),
        changed_by: changedBy,
      }))

      await supabase.from('invoice_audit_log').insert(auditEntries)
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
